import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { AuthUser } from '../auth/rbac.js'
import { createMemoryStorage } from '../files/storage.js'

const config = loadConfig({ NODE_ENV: 'test' })
const { storage, objects } = createMemoryStorage()
const app = buildApp(config, { storage })
const tag = randomUUID().slice(0, 8)
const users = {} as Record<'board' | 'manager', AuthUser>
let boardId = ''
let departmentId = ''
let archivedDepartmentId = ''

async function createUser(username: string, role?: 'BOARD' | 'DEPARTMENT_MANAGER') {
  const user = await db.user.create({
    data: {
      username: `${username}-${tag}`,
      email: `${username}-${tag}@test.local`,
      fullName: `D5 ${username}`,
      passwordHash: 'not-used',
      status: 'ACTIVE',
      mustChangePassword: false,
      departmentId: role === 'DEPARTMENT_MANAGER' ? departmentId : null,
    },
  })
  const key = role === 'BOARD' ? 'board' : 'manager'
  users[key] = {
    id: user.id,
    departmentId: role === 'DEPARTMENT_MANAGER' ? departmentId : null,
    roles: role ? [{ role, departmentId: role === 'DEPARTMENT_MANAGER' ? departmentId : null }] : [],
  }
  return user
}

app.addHook('onRequest', async (request) => {
  const key = request.headers['x-test-user'] as 'board' | 'manager' | undefined
  request.user = key ? users[key] ?? null : null
})

function multipart(file: string, fields: Record<string, string> = {}) {
  const boundary = `----apc-d5-${randomUUID()}`
  const chunks: Buffer[] = []
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`))
  }
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="members.csv"\r\nContent-Type: text/csv\r\n\r\n${file}\r\n--${boundary}--\r\n`))
  return { payload: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` }
}

function postCsv(url: string, user: 'board' | 'manager' | null, csv: string, fields: Record<string, string> = {}) {
  const body = multipart(csv, fields)
  return app.inject({
    method: 'POST',
    url,
    headers: {
      origin: config.WEB_URL,
      'content-type': body.contentType,
      ...(user ? { 'x-test-user': user } : {}),
    },
    payload: body.payload,
  })
}

const csv = (username = `csv-${tag}`, studentId = `D5-${tag.toUpperCase()}`, departmentCode = `d5-${tag}`) =>
  `fullName,username,email,studentId,faculty,major,cohort,departmentCode\r\nNguyễn Văn D5,${username},${username}@example.com,${studentId},Khoa mẫu,Ngành mẫu,K29,${departmentCode}\r\n`

beforeAll(async () => {
  await app.ready()
  const active = await db.department.create({ data: { name: `D5 Active ${tag}`, code: `d5-${tag}` } })
  const archived = await db.department.create({ data: { name: `D5 Archived ${tag}`, code: `d5-old-${tag}`, status: 'ARCHIVED' } })
  departmentId = active.id
  archivedDepartmentId = archived.id
  const board = await createUser('d5-board', 'BOARD')
  await createUser('d5-manager', 'DEPARTMENT_MANAGER')
  boardId = board.id
})

afterAll(async () => {
  const users = await db.user.findMany({ where: { username: { endsWith: `-${tag}` } }, select: { id: true } })
  const ids = users.map(({ id }) => id)
  const exports = await db.exportFile.findMany({ where: { createdById: { in: ids } }, select: { id: true, storageKey: true } })
  for (const file of exports) objects.delete(file.storageKey)
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { targetId: { in: [...ids, ...exports.map(({ id }) => id)] } }] } })
  await db.exportFile.deleteMany({ where: { id: { in: exports.map(({ id }) => id) } } })
  await db.userRole.deleteMany({ where: { userId: { in: ids } } })
  await db.user.deleteMany({ where: { id: { in: ids } } })
  await db.department.deleteMany({ where: { id: { in: [departmentId, archivedDepartmentId] } } })
  await app.close()
})

describe('D5: nhập/xuất CSV thành viên', () => {
  it('BOARD tải mẫu; người không có quyền bị từ chối', async () => {
    const allowed = await app.inject({ method: 'GET', url: '/admin/members/import/template', headers: { 'x-test-user': 'board' } })
    expect(allowed.statusCode).toBe(200)
    expect(allowed.headers['content-type']).toContain('text/csv')
    expect(allowed.body).toContain('fullName,username,email,studentId,faculty,major,cohort,departmentCode')
    const denied = await app.inject({ method: 'GET', url: '/admin/members/import/template', headers: { 'x-test-user': 'manager' } })
    expect(denied.statusCode).toBe(403)
  })

  it('kiểm tra CSV không ghi database, báo chính xác dòng/cột; chỉ BOARD được kiểm tra', async () => {
    const candidate = `csv-${tag}`
    const before = await db.user.count({ where: { username: candidate } })
    const allowed = await postCsv('/admin/members/import/validate', 'board', csv(candidate))
    expect(allowed.statusCode).toBe(200)
    expect(allowed.json()).toMatchObject({ validRows: 1, totalRows: 1, errors: [] })
    expect(allowed.json().fileHash).toMatch(/^[a-f0-9]{64}$/)
    expect(allowed.json().batchId).toMatch(/^[a-f0-9]{64}$/)
    expect(await db.user.count({ where: { username: candidate } })).toBe(before)

    const invalid = await postCsv('/admin/members/import/validate', 'board', csv(candidate, 'bad student id', `d5-${tag}`))
    expect(invalid.statusCode).toBe(200)
    expect(invalid.json().errors).toContainEqual(expect.objectContaining({ row: 2, column: 'studentId' }))
    const badEmailCsv = csv(candidate, `D5-${tag.toUpperCase()}`).replace(`${candidate}@example.com`, 'invalid-email')
    const badEmailCheck = await postCsv('/admin/members/import/validate', 'board', badEmailCsv)
    const rejectedCommit = await postCsv('/admin/members/import/commit', 'board', badEmailCsv, { batchId: badEmailCheck.json().batchId })
    expect(rejectedCommit.statusCode).toBe(422)
    expect(await db.user.count({ where: { username: candidate } })).toBe(before)
    const denied = await postCsv('/admin/members/import/validate', 'manager', csv())
    expect(denied.statusCode).toBe(403)
  })

  it('từ chối header sai, quá 500 dòng và ban ARCHIVED trước khi nhập', async () => {
    const wrongHeader = await postCsv('/admin/members/import/validate', 'board', 'name,username\r\nA,b\r\n')
    expect(wrongHeader.statusCode).toBe(422)

    const overLimit = `fullName,username,email,studentId,faculty,major,cohort,departmentCode\r\n${Array.from({ length: 501 }, (_, i) => `A,over-${i}-${tag},over-${i}@example.com,ID-${i}-X,,,,d5-${tag}`).join('\r\n')}`
    const tooMany = await postCsv('/admin/members/import/validate', 'board', overLimit)
    expect(tooMany.statusCode).toBe(422)

    const tooLarge = await postCsv('/admin/members/import/validate', 'board', 'x'.repeat(2 * 1024 * 1024 + 1))
    expect(tooLarge.statusCode).toBe(422)

    const archived = await postCsv('/admin/members/import/validate', 'board', csv(`archive-${tag}`, `AR-${tag.toUpperCase()}`, `d5-old-${tag}`))
    expect(archived.statusCode).toBe(200)
    expect(archived.json().errors).toContainEqual(expect.objectContaining({ row: 2, column: 'departmentCode', message: 'Ban đã lưu trữ, không thể gán thành viên mới.' }))
  })

  it('nhập nguyên lô trong một transaction, idempotent và audit có hash/mã lô', async () => {
    const username = `commit-${tag}`
    const content = csv(username, `CM-${tag.toUpperCase()}`)
    const checked = await postCsv('/admin/members/import/validate', 'board', content)
    const { batchId, fileHash } = checked.json<{ batchId: string; fileHash: string }>()

    const imported = await postCsv('/admin/members/import/commit', 'board', content, { batchId })
    expect(imported.statusCode).toBe(201)
    expect(imported.json()).toMatchObject({ batchId, importedRows: 1, alreadyImported: false })
    const user = await db.user.findUniqueOrThrow({ where: { username } })
    expect(user).toMatchObject({
      status: 'PENDING_ACTIVATION',
      isTemporaryPassword: true,
      mustChangePassword: true,
      studentId: `CM-${tag.toUpperCase()}`,
      faculty: 'Khoa mẫu',
      major: 'Ngành mẫu',
      cohort: 'K29',
      departmentId,
    })
    expect(imported.json()).not.toHaveProperty('temporaryPassword')
    expect(await db.userRole.count({ where: { userId: user.id } })).toBe(0)

    const replay = await postCsv('/admin/members/import/commit', 'board', content, { batchId })
    expect(replay.statusCode).toBe(201)
    expect(replay.json()).toMatchObject({ batchId, alreadyImported: true })
    expect(await db.user.count({ where: { username } })).toBe(1)
    const audit = await db.auditLog.findFirstOrThrow({
      where: { actorId: boardId, action: 'member.import', targetType: 'MEMBER_IMPORT_BATCH', targetId: batchId },
    })
    expect(audit.metadata).toMatchObject({ batchId, fileHash, rowCount: 1 })

    const denied = await postCsv('/admin/members/import/commit', 'manager', content, { batchId })
    expect(denied.statusCode).toBe(403)
  })

  it('xuất CSV qua D6 có audit và manager bị từ chối', async () => {
    const allowed = await app.inject({ method: 'POST', url: '/admin/members/export', headers: { origin: config.WEB_URL, 'x-test-user': 'board' } })
    expect(allowed.statusCode).toBe(201)
    const created = allowed.json<{ id: string }>()
    const audit = await db.auditLog.findFirstOrThrow({ where: { targetType: 'EXPORT_FILE', targetId: created.id, action: 'member.export' } })
    expect(audit.actorId).toBe(boardId)
    expect(audit.metadata).toMatchObject({ kind: 'member', rowCount: expect.any(Number) })

    const denied = await app.inject({ method: 'POST', url: '/admin/members/export', headers: { origin: config.WEB_URL, 'x-test-user': 'manager' } })
    expect(denied.statusCode).toBe(403)
  })
})

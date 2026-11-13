import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { AuthUser } from '../auth/rbac.js'
import { requireAuth } from '../auth/rbac.js'
import { createMemoryStorage } from '../files/storage.js'
import { cleanupExpiredExports, createExport, type CreateExportInput, type ExportsContext } from './service.js'

const ORIGIN = 'http://localhost:5173'
const tag = randomUUID().slice(0, 8)
const context: ExportsContext & ReturnType<typeof createMemoryStorage> = createMemoryStorage()
const userIds: string[] = []
const exportIds: string[] = []

type UserKey = 'board' | 'manager' | 'member'
const users = {} as Record<UserKey, AuthUser>

const app = buildApp(loadConfig({ NODE_ENV: 'test' }), { storage: context.storage })
app.addHook('onRequest', async (request) => {
  const key = request.headers['x-test-user'] as UserKey | undefined
  request.user = key ? users[key] ?? null : null
})

// D6 exposes only the download endpoint. This harness route invokes the internal service like a domain route.
app.post('/__test/exports', { preHandler: requireAuth }, async (request, reply) => {
  const created = await createExport(request, request.body as CreateExportInput, context)
  exportIds.push(created.id)
  return reply.code(201).send(created)
})

function create(input: CreateExportInput, user: UserKey | null = 'board') {
  return app.inject({
    method: 'POST',
    url: '/__test/exports',
    payload: input,
    headers: {
      origin: ORIGIN,
      ...(user ? { 'x-test-user': user } : {}),
    },
  })
}

function download(id: string, user: UserKey | null) {
  return app.inject({
    method: 'GET',
    url: `/portal/exports/${id}/download`,
    headers: user ? { 'x-test-user': user } : {},
  })
}

beforeAll(async () => {
  await app.ready()
  for (const key of ['board', 'manager', 'member'] as const) {
    const user = await db.user.create({
      data: {
        username: `exports-${key}-${tag}`,
        email: `exports-${key}-${tag}@test.local`,
        passwordHash: 'not-used',
        fullName: `Exports ${key}`,
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    })
    userIds.push(user.id)
    const memberRole = { role: 'MEMBER' as const, departmentId: null }
    users[key] = {
      id: user.id,
      departmentId: null,
      roles:
        key === 'board'
          ? [memberRole, { role: 'BOARD', departmentId: null }]
          : key === 'manager'
            ? [memberRole, { role: 'DEPARTMENT_MANAGER', departmentId: null }]
            : [memberRole],
    }
  }
})

afterAll(async () => {
  await app.close()
  await db.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: userIds } },
        { targetId: { in: [...exportIds, '/__test/exports'] } },
      ],
    },
  })
  await db.exportFile.deleteMany({ where: { id: { in: exportIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
})

describe('D6 protected exports', () => {
  it('cho người được chỉ định tải CSV, có BOM, giữ tiếng Việt, chống công thức và ghi audit', async () => {
    const response = await create({
      kind: 'member',
      filename: 'thanh-vien.csv',
      rows: [{ name: 'Nguyễn Văn An', note: '=1+1' }],
    })

    expect(response.statusCode).toBe(201)
    const created = response.json<{ id: string; status: string; filename: string; expiresAt: string }>()
    expect(created).toMatchObject({ status: 'READY', filename: 'thanh-vien.csv' })
    const record = await db.exportFile.findUniqueOrThrow({ where: { id: created.id } })
    expect(record).toMatchObject({ createdById: users.board.id, downloaderId: users.board.id, kind: 'member', status: 'READY' })
    expect(record.expiresAt.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000)
    expect(context.objects.has(record.storageKey)).toBe(true)

    const denied = await download(created.id, 'member')
    expect(denied.statusCode).toBe(404)

    const downloaded = await download(created.id, 'board')
    expect(downloaded.statusCode).toBe(200)
    expect(downloaded.headers['content-type']).toContain('text/csv')
    expect(downloaded.headers['cache-control']).toBe('private, no-store')
    const csvBytes = Buffer.from(downloaded.body, 'utf8')
    expect(csvBytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]))
    expect(downloaded.body).toContain('Nguyễn Văn An')
    expect(downloaded.body).toContain("'=1+1")

    const audit = await db.auditLog.findFirstOrThrow({
      where: { targetType: 'EXPORT_FILE', targetId: created.id, action: 'member.export', result: 'SUCCESS' },
    })
    expect(audit.actorId).toBe(users.board.id)
    expect(audit.metadata).toMatchObject({ kind: 'member', rowCount: 1 })
  })

  it('giao file yêu cầu dữ liệu cho người khác tải: người đó phải ACTIVE, người tạo không tải thay được', async () => {
    const created = await create({
      kind: 'data_request',
      filename: 'du-lieu-ca-nhan.csv',
      rows: [{ field: 'email', value: 'member@test.local', balance: -5 }],
      downloaderId: users.member.id,
    })
    expect(created.statusCode).toBe(201)
    const { id } = created.json<{ id: string }>()

    expect((await download(id, 'board')).statusCode).toBe(404)
    const downloaded = await download(id, 'member')
    expect(downloaded.statusCode).toBe(200)
    // Số âm không bị biến thành chuỗi '-5.
    expect(downloaded.body).toContain(',-5')
    expect(downloaded.body).not.toContain("'-5")
    expect(
      await db.auditLog.findFirst({
        where: { targetType: 'EXPORT_FILE', targetId: id, action: 'export.download', actorId: users.member.id },
      }),
    ).not.toBeNull()

    const inactive = await db.user.create({
      data: {
        username: `exports-inactive-${tag}`,
        email: `exports-inactive-${tag}@test.local`,
        passwordHash: 'not-used',
        fullName: 'Exports inactive',
        status: 'INACTIVE',
        mustChangePassword: false,
      },
    })
    userIds.push(inactive.id)
    for (const downloaderId of [inactive.id, randomUUID()]) {
      const denied = await create({ kind: 'data_request', filename: 'x.csv', rows: [], downloaderId })
      expect(denied.statusCode).toBe(422)
      expect(denied.json().issues[0].path).toEqual(['downloaderId'])
    }
    const wrongKind = await create({ kind: 'member', filename: 'x.csv', rows: [], downloaderId: users.member.id })
    expect(wrongKind.statusCode).toBe(422)
  })

  it('người tạo bị thu vai trò sau khi tạo thì không tải được nữa', async () => {
    const created = await create({ kind: 'member', filename: 'thanh-vien.csv', rows: [{ name: 'An' }] })
    expect(created.statusCode).toBe(201)
    const { id } = created.json<{ id: string }>()
    const roles = users.board.roles
    users.board.roles = roles.filter((grant) => grant.role !== 'BOARD')
    try {
      expect((await download(id, 'board')).statusCode).toBe(404)
    } finally {
      users.board.roles = roles
    }
    expect((await download(id, 'board')).statusCode).toBe(200)
  })

  it('từ chối tạo file nếu người gọi không có quyền export loại đó', async () => {
    const before = await db.exportFile.count()
    const response = await create(
      { kind: 'member', filename: 'thanh-vien.csv', rows: [{ name: 'Không được xuất' }] },
      'manager',
    )

    expect(response.statusCode).toBe(403)
    expect(await db.exportFile.count()).toBe(before)
  })

  it('hết hạn thì trả 404; cleanup xóa object, chuyển EXPIRED và ghi audit', async () => {
    const createdResponse = await create({
      kind: 'event',
      filename: 'dang-ky.csv',
      rows: [{ name: 'Nguyễn Văn Bình', email: 'binh@example.test' }],
    })
    expect(createdResponse.statusCode).toBe(201)
    const created = createdResponse.json<{ id: string }>()
    const record = await db.exportFile.findUniqueOrThrow({ where: { id: created.id } })

    const expiredAt = new Date(Date.now() - 1)
    await db.exportFile.update({ where: { id: created.id }, data: { expiresAt: expiredAt } })
    expect((await download(created.id, 'board')).statusCode).toBe(404)

    const cleanup = await cleanupExpiredExports(context, new Date(), 10)
    expect(cleanup.expired).toBeGreaterThanOrEqual(1)
    expect(context.objects.has(record.storageKey)).toBe(false)
    expect(await db.exportFile.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ status: 'EXPIRED' })
    expect((await download(created.id, 'board')).statusCode).toBe(404)
    expect(
      await db.auditLog.findFirst({
        where: { targetType: 'EXPORT_FILE', targetId: created.id, action: 'export.expire', result: 'SUCCESS' },
      }),
    ).not.toBeNull()
  })
})

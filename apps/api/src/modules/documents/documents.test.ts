import { randomUUID } from 'node:crypto'

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { AuthUser } from '../auth/rbac.js'
import { createMemoryStorage } from '../files/storage.js'

const ORIGIN = 'http://localhost:5173'
const tag = randomUUID().slice(0, 8)
const storageContext = createMemoryStorage()
const app: FastifyInstance = buildApp(loadConfig({ NODE_ENV: 'test' }), { storage: storageContext.storage })
const userIds: string[] = []
const documentIds: string[] = []
const fileIds: string[] = []
const departmentIds: string[] = []
const users = {} as Record<'board' | 'managerA' | 'managerB' | 'memberA' | 'memberB' | 'tech', AuthUser>

app.addHook('onRequest', async (request) => {
  const key = request.headers['x-test-user'] as keyof typeof users | undefined
  request.user = key ? users[key] ?? null : null
})

function call(method: 'GET' | 'POST' | 'PATCH', url: string, user: keyof typeof users | null, body?: unknown) {
  return app.inject({
    method,
    url,
    ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
    headers: { ...(method === 'GET' ? {} : { origin: ORIGIN }), ...(user ? { 'x-test-user': user } : {}) },
  })
}

async function makeFile(uploadedById: string, key: string) {
  const storageKey = `tests/${tag}/${key}`
  storageContext.objects.set(storageKey, Buffer.from(key))
  const file = await db.storedFile.create({
    data: {
      storageKey,
      originalName: `${key}.pdf`,
      mimeType: 'application/pdf',
      size: Buffer.byteLength(key),
      purpose: 'DOCUMENT',
      visibility: 'INTERNAL',
      scanStatus: 'CLEAN',
      uploadedById,
    },
  })
  fileIds.push(file.id)
  return file
}

beforeAll(async () => {
  await app.ready()
  const departmentA = await db.department.create({ data: { name: `Documents A ${tag}`, code: `doc-a-${tag}` } })
  const departmentB = await db.department.create({ data: { name: `Documents B ${tag}`, code: `doc-b-${tag}` } })
  departmentIds.push(departmentA.id, departmentB.id)
  for (const key of ['board', 'managerA', 'managerB', 'memberA', 'memberB', 'tech'] as const) {
    const departmentId = key.endsWith('A') ? departmentA.id : key.endsWith('B') ? departmentB.id : null
    const dbUser = await db.user.create({
      data: {
        username: `documents-${key}-${tag}`,
        email: `documents-${key}-${tag}@test.local`,
        passwordHash: 'not-used',
        fullName: `Documents ${key}`,
        status: 'ACTIVE',
        mustChangePassword: false,
        departmentId,
      },
    })
    userIds.push(dbUser.id)
    const roles: AuthUser['roles'] = [{ role: 'MEMBER', departmentId }]
    if (key === 'board') roles.push({ role: 'BOARD', departmentId: null })
    if (key === 'tech') roles.push({ role: 'TECH_ADMIN', departmentId: null })
    if (key === 'managerA') roles.push({ role: 'DEPARTMENT_MANAGER', departmentId: departmentA.id })
    if (key === 'managerB') roles.push({ role: 'DEPARTMENT_MANAGER', departmentId: departmentB.id })
    users[key] = { id: dbUser.id, departmentId, roles }
  }
})

afterAll(async () => {
  await app.close()
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { targetId: { in: [...documentIds, '/admin/documents', '/portal/documents'] } }] } })
  await db.documentVersion.deleteMany({ where: { documentId: { in: documentIds } } })
  await db.document.deleteMany({ where: { id: { in: documentIds } } })
  await db.storedFile.deleteMany({ where: { id: { in: fileIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await db.department.deleteMany({ where: { id: { in: departmentIds } } })
})

describe('D4 document library', () => {
  it('checks department access at download time and hides TECH_ADMIN content', async () => {
    const file = await makeFile(users.managerA.id, 'initial')
    const created = await call('POST', '/admin/documents', 'managerA', {
      title: 'Quy trình Ban A', category: 'Quy trình', departmentId: users.managerA.roles.find((role) => role.role === 'DEPARTMENT_MANAGER')?.departmentId,
      scope: 'DEPARTMENT', allowedRoles: [], storedFileId: file.id, reason: 'Tạo tài liệu thử nghiệm',
    })
    expect(created.statusCode).toBe(201)
    const document = created.json<{ id: string; currentVersion: { id: string }; updatedAt: string }>()
    documentIds.push(document.id)

    expect((await call('GET', `/portal/documents/${document.id}`, 'memberA')).statusCode).toBe(200)
    expect((await call('GET', `/portal/documents/${document.id}`, 'memberB')).statusCode).toBe(404)
    expect((await call('GET', `/portal/documents/${document.id}/versions/${document.currentVersion.id}/download`, 'memberB')).statusCode).toBe(404)
    expect((await call('GET', '/admin/documents', 'tech')).statusCode).toBe(404)
    expect((await call('GET', `/admin/documents/${document.id}`, 'tech')).statusCode).toBe(404)
    expect((await call('GET', '/portal/documents', 'tech')).statusCode).toBe(404)

    expect((await call('PATCH', `/admin/documents/${document.id}`, 'managerA', {
      title: 'Tài liệu CLB', category: 'Quy trình', departmentId: null, scope: 'CLUB', allowedRoles: [],
      reason: 'Thử mở rộng quyền', updatedAt: document.updatedAt,
    })).statusCode).toBe(403)

    const updated = await call('PATCH', `/admin/documents/${document.id}`, 'board', {
      title: 'Tài liệu giới hạn vai trò', category: 'Quy trình', departmentId: users.managerA.roles.find((role) => role.role === 'DEPARTMENT_MANAGER')?.departmentId,
      scope: 'DEPARTMENT', allowedRoles: ['BOARD'], reason: 'Giới hạn quyền xem', updatedAt: (await db.document.findUniqueOrThrow({ where: { id: document.id } })).updatedAt.toISOString(),
    })
    expect(updated.statusCode).toBe(200)
    expect((await call('GET', `/portal/documents/${document.id}`, 'memberA')).statusCode).toBe(404)
    expect((await call('GET', `/portal/documents/${document.id}/versions/${document.currentVersion.id}/download`, 'memberA')).statusCode).toBe(404)
  })

  it('retains old files, restores by appending a version, and archives access', async () => {
    const first = await makeFile(users.managerA.id, 'first')
    const created = await call('POST', '/admin/documents', 'managerA', {
      title: 'Tài liệu phiên bản', category: 'Biểu mẫu', departmentId: users.managerA.roles.find((role) => role.role === 'DEPARTMENT_MANAGER')?.departmentId,
      scope: 'DEPARTMENT', allowedRoles: [], storedFileId: first.id, reason: 'Tạo tài liệu thử nghiệm',
    })
    const document = created.json<{ id: string; currentVersion: { id: string }; updatedAt: string }>()
    documentIds.push(document.id)
    const second = await makeFile(users.managerA.id, 'second')

    expect((await call('POST', `/admin/documents/${document.id}/versions`, 'managerA', {
      storedFileId: second.id, reason: 'Cập nhật bản mới', updatedAt: document.updatedAt,
    })).statusCode).toBe(200)
    let current = await db.document.findUniqueOrThrow({ where: { id: document.id }, include: { versions: { orderBy: { versionNumber: 'desc' } } } })
    expect(current.versions).toHaveLength(2)
    expect((await call('GET', `/portal/documents/${document.id}/versions/${current.versions[0]?.id}/download`, 'memberA')).statusCode).toBe(200)
    expect((await call('GET', `/portal/documents/${document.id}/versions/${document.currentVersion.id}/download`, 'memberA')).statusCode).toBe(200)

    const restored = await call('POST', `/admin/documents/${document.id}/versions/${document.currentVersion.id}/restore`, 'managerA', {
      reason: 'Khôi phục bản cũ', updatedAt: current.updatedAt.toISOString(),
    })
    expect(restored.statusCode).toBe(200)
    current = await db.document.findUniqueOrThrow({ where: { id: document.id }, include: { versions: { orderBy: { versionNumber: 'desc' } } } })
    expect(current.versions).toHaveLength(3)
    expect(current.versions[0]?.storedFileId).toBe(first.id)
    expect((await call('GET', `/portal/documents/${document.id}/versions/${current.versions[0]?.id}/download`, 'memberA')).statusCode).toBe(200)

    const archived = await call('POST', `/admin/documents/${document.id}/archive`, 'managerA', {
      reason: 'Tài liệu không còn dùng', updatedAt: current.updatedAt.toISOString(),
    })
    expect(archived.statusCode).toBe(200)
    expect((await call('GET', `/portal/documents/${document.id}`, 'memberA')).statusCode).toBe(404)
    const portalList = await call('GET', '/portal/documents?page=1&pageSize=100', 'memberA')
    expect(portalList.json<{ items: { id: string }[] }>().items.some((item) => item.id === document.id)).toBe(false)
    expect((await call('GET', `/portal/documents/${document.id}/versions/${current.versions[0]?.id}/download`, 'memberA')).statusCode).toBe(404)
    const restoredDocument = await call('POST', `/admin/documents/${document.id}/restore`, 'managerA', {
      reason: 'Tài liệu cần sử dụng lại', updatedAt: archived.json<{ updatedAt: string }>().updatedAt,
    })
    expect(restoredDocument.statusCode).toBe(200)
    expect((await call('GET', `/portal/documents/${document.id}`, 'memberA')).statusCode).toBe(200)
  })

  it('hides another department from managers and audits incident metadata access', async () => {
    const file = await makeFile(users.managerB.id, 'metadata')
    const created = await call('POST', '/admin/documents', 'managerB', {
      title: 'Metadata Ban B', category: 'Tài liệu', departmentId: users.managerB.roles.find((role) => role.role === 'DEPARTMENT_MANAGER')?.departmentId,
      scope: 'DEPARTMENT', allowedRoles: [], storedFileId: file.id, reason: 'Tạo tài liệu thử nghiệm',
    })
    const document = created.json<{ id: string; currentVersion: { id: string } }>()
    documentIds.push(document.id)
    expect((await call('GET', `/admin/documents/${document.id}`, 'managerA')).statusCode).toBe(404)
    const outsiderEdit = await call('PATCH', `/admin/documents/${document.id}`, 'managerA', {
      title: 'Không có quyền', category: 'Tài liệu', departmentId: users.managerB.roles.find((role) => role.role === 'DEPARTMENT_MANAGER')?.departmentId,
      scope: 'DEPARTMENT', allowedRoles: [], reason: 'Thử sửa ngoài ban', updatedAt: (await db.document.findUniqueOrThrow({ where: { id: document.id } })).updatedAt.toISOString(),
    })
    expect(outsiderEdit.statusCode).toBe(404)
    expect((await call('POST', `/admin/documents/${document.id}/versions/${document.currentVersion.id}/metadata`, 'tech', {})).statusCode).toBe(422)

    const metadata = await call('POST', `/admin/documents/${document.id}/versions/${document.currentVersion.id}/metadata`, 'tech', {
      incidentId: 'INC-20261111-01', reason: 'Điều tra cảnh báo bảo mật',
    })
    expect(metadata.statusCode).toBe(200)
    expect(metadata.json()).toMatchObject({ storageKey: file.storageKey, size: file.size, scanStatus: 'CLEAN' })
    const auditLog = await db.auditLog.findFirst({ where: { actorId: users.tech.id, targetId: document.currentVersion.id } })
    expect(auditLog).toMatchObject({ action: 'system.incident_access', category: 'SECURITY', incidentId: 'INC-20261111-01' })
  })
})

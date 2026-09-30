import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import {
  type AuthUser,
  canAccessDepartment,
  currentUser,
  departmentScope,
  requireAuth,
  requireRole,
  requireScope,
} from './rbac.js'

// A1: gán sẵn request.user giả qua header, chưa cần đăng nhập thật (docs/plan/A-dang-nhap.md).
const USERS = {
  member: { id: 'u-member', departmentId: 'dept-a', roles: [] },
  managerA: { id: 'u-manager-a', departmentId: 'dept-a', roles: [{ role: 'DEPARTMENT_MANAGER', departmentId: 'dept-a' }] },
  managerAB: {
    id: 'u-manager-ab',
    departmentId: 'dept-a',
    roles: [
      { role: 'DEPARTMENT_MANAGER', departmentId: 'dept-a' },
      { role: 'DEPARTMENT_MANAGER', departmentId: 'dept-b' },
    ],
  },
  board: { id: 'u-board', departmentId: null, roles: [{ role: 'BOARD', departmentId: null }] },
  techAdmin: { id: 'u-tech', departmentId: 'dept-a', roles: [{ role: 'TECH_ADMIN', departmentId: null }] },
} satisfies Record<string, AuthUser>
type UserKey = keyof typeof USERS

// Tài liệu giả: mỗi tài liệu thuộc một ban (hoặc toàn CLB).
const DOCUMENTS: Record<string, { departmentId: string | null }> = {
  'doc-a': { departmentId: 'dept-a' },
  'doc-b': { departmentId: 'dept-b' },
  'doc-club': { departmentId: null },
}

const app = buildApp(loadConfig({ NODE_ENV: 'test' }))

beforeAll(async () => {
  app.addHook('onRequest', async (request) => {
    const key = request.headers['x-test-user']
    request.user = typeof key === 'string' && key in USERS ? USERS[key as UserKey] : null
  })
  app.get('/portal/ping', { preHandler: requireAuth }, async (request) => ({ id: currentUser(request).id }))
  app.get('/admin/board-only', { preHandler: requireRole('BOARD') }, async () => ({ ok: true }))
  app.get('/admin/tech-only', { preHandler: requireRole('TECH_ADMIN') }, async () => ({ ok: true }))
  app.get(
    '/admin/documents/:id',
    {
      preHandler: [
        requireRole('DEPARTMENT_MANAGER', 'BOARD'),
        requireScope(async ({ id }) => DOCUMENTS[id] ?? null),
      ],
    },
    async (request) => ({ id: (request.params as { id: string }).id }),
  )
  await app.ready()
})

afterAll(() => app.close())

const call = (url: string, user?: UserKey) =>
  app.inject({ method: 'GET', url, headers: user ? { 'x-test-user': user } : {} })

describe('requireAuth', () => {
  it('rejects a request without a session with 401 unauthenticated', async () => {
    const response = await call('/portal/ping')
    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'unauthenticated', message: expect.any(String) })
  })

  it.each(Object.keys(USERS) as UserKey[])('lets %s in and exposes request.user', async (user) => {
    const response = await call('/portal/ping', user)
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ id: USERS[user].id })
  })
})

describe('requireRole', () => {
  it.each([
    ['/admin/board-only', undefined, 401],
    ['/admin/board-only', 'member', 403],
    ['/admin/board-only', 'managerA', 403],
    ['/admin/board-only', 'techAdmin', 403],
    ['/admin/board-only', 'board', 200],
    ['/admin/tech-only', 'board', 403],
    ['/admin/tech-only', 'techAdmin', 200],
  ] as const)('GET %s as %s → %i', async (url, user, status) => {
    const response = await call(url, user)
    expect(response.statusCode).toBe(status)
    if (status === 403) expect(response.json().error).toBe('forbidden')
  })
})

describe('requireScope', () => {
  // 4 vai trò trên cùng một endpoint quản trị có phạm vi ban.
  it.each([
    [undefined, 'doc-a', 401],
    ['member', 'doc-a', 403],
    ['techAdmin', 'doc-a', 403],
    ['managerA', 'doc-a', 200],
    ['managerA', 'doc-b', 404],
    ['managerA', 'doc-club', 404],
    ['managerA', 'doc-missing', 404],
    ['managerAB', 'doc-a', 200],
    ['managerAB', 'doc-b', 200],
    ['board', 'doc-a', 200],
    ['board', 'doc-b', 200],
    ['board', 'doc-club', 200],
    ['board', 'doc-missing', 404],
  ] as const)('%s opening %s → %i', async (user, id, status) => {
    const response = await call(`/admin/documents/${id}`, user)
    expect(response.statusCode).toBe(status)
  })

  it('answers out-of-scope exactly like a missing document, so existence is not leaked', async () => {
    const outOfScope = await call('/admin/documents/doc-b', 'managerA')
    const missing = await call('/admin/documents/doc-missing', 'managerA')
    expect(outOfScope.statusCode).toBe(404)
    expect(outOfScope.json()).toEqual({ error: 'not_found', message: expect.any(String) })
    expect(outOfScope.body).toBe(missing.body)
  })
})

describe('scope helpers', () => {
  it('limits business data by department', () => {
    expect(canAccessDepartment(USERS.board, 'dept-b')).toBe(true)
    expect(canAccessDepartment(USERS.managerA, 'dept-a')).toBe(true)
    expect(canAccessDepartment(USERS.managerA, 'dept-b')).toBe(false)
    // Thành viên ban A (MEMBER) và TECH_ADMIN không có quyền nghiệp vụ theo ban (docs/02 mục 2.5).
    expect(canAccessDepartment(USERS.member, 'dept-a')).toBe(false)
    expect(canAccessDepartment(USERS.techAdmin, 'dept-a')).toBe(false)
  })

  it('builds the Prisma filter for lists', () => {
    expect(departmentScope(USERS.board)).toEqual({})
    expect(departmentScope(USERS.managerAB)).toEqual({ departmentId: { in: ['dept-a', 'dept-b'] } })
    expect(departmentScope(USERS.member)).toEqual({ departmentId: { in: [] } })
    expect(departmentScope(USERS.techAdmin)).toEqual({ departmentId: { in: [] } })
  })
})

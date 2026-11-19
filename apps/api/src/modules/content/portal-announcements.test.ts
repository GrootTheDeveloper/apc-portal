import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { AuthUser } from '../auth/rbac.js'

/**
 * Test tích hợp cho /portal/announcements (Task C5-P3).
 * Dùng hook onRequest x-test-user để giả lập auth — tương tự admin-posts.test.ts.
 * Postgres thật; mỗi run dùng tag UUID riêng để tránh va chạm.
 */

const ORIGIN = 'http://localhost:5173'
const tag = randomUUID().slice(0, 8)
const config = loadConfig({ NODE_ENV: 'test' })

// ─── DỮ LIỆU NGƯỜI DÙNG TEST ─────────────────────────────────────────────────

type UserKey = 'memberA' | 'managerA' | 'memberB' | 'board' | 'techAdmin'

let banAId: string
let banBId: string
const users = {} as Record<UserKey, AuthUser>
const createdUserIds: string[] = []
const createdDeptIds: string[] = []
const createdPostIds: string[] = []

let postAllId: string
let postDeptAId: string
let postManagerOnlyId: string
let postMemberTargetId: string
let postDraftId: string
let postArchivedId: string

// ─── APP TEST (inject x-test-user) ───────────────────────────────────────────

const app = buildApp(config)
app.addHook('onRequest', async (request) => {
  const key = request.headers['x-test-user'] as UserKey | undefined
  if (key && users[key]) request.user = users[key]
})

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Tạo user tối giản trong DB, trả AuthUser cho hook. */
async function createUser(
  suffix: string,
  departmentId: string | null,
): Promise<AuthUser> {
  const user = await db.user.create({
    data: {
      username: `ann-${suffix}-${tag}`,
      email: `ann-${suffix}-${tag}@test.local`,
      passwordHash: 'dummy',
      fullName: `Test ${suffix}`,
      mustChangePassword: false,
      status: 'ACTIVE',
      departmentId,
    },
  })
  createdUserIds.push(user.id)
  return { id: user.id, departmentId, roles: [] }
}

/** Tạo department tối giản. */
async function createDept(code: string) {
  const dept = await db.department.create({
    data: { name: `Ban ${code} ${tag}`, code: `${code}-${tag}` },
  })
  createdDeptIds.push(dept.id)
  return dept
}

/** Tạo thông báo trực tiếp qua DB (mọi bài INTERNAL, của board). */
async function seedPost(opts: {
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  audience?: 'ALL' | 'DEPARTMENT' | 'ROLES'
  audienceDepartmentId?: string | null
  audienceRoles?: ('MEMBER' | 'DEPARTMENT_MANAGER' | 'BOARD' | 'TECH_ADMIN')[]
}) {
  const suffix = randomUUID().slice(0, 6)
  const post = await db.post.create({
    data: {
      title: `Thông báo ${suffix}`,
      slug: `ann-${suffix}-${tag}`,
      summary: 'Tóm tắt thông báo',
      content: 'Nội dung thông báo.',
      category: 'Thông báo',
      status: opts.status,
      scope: 'INTERNAL',
      audience: opts.audience ?? 'ALL',
      audienceDepartmentId: opts.audienceDepartmentId ?? null,
      audienceRoles: opts.audienceRoles ?? [],
      authorId: users.board.id,
      departmentId: null,
      publishedAt: opts.status === 'PUBLISHED' ? new Date() : null,
    },
  })
  createdPostIds.push(post.id)
  return post
}

/** Inject helper dùng chung, tự gán origin và x-test-user. */
async function req(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  user: UserKey | null,
) {
  // Dùng any để tránh lỗi type phức tạp của Fastify inject overload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (app.inject as any)({
    method,
    url,
    headers: {
      origin: ORIGIN,
      ...(user ? { 'x-test-user': user } : {}),
    },
  })
  return res as { statusCode: number; json: () => any }
}

// ─── SETUP / TEARDOWN ────────────────────────────────────────────────────────

beforeAll(async () => {
  await app.ready()

  const banA = await createDept('A')
  const banB = await createDept('B')
  banAId = banA.id
  banBId = banB.id

  const memberARaw = await createUser('member-a', banAId)
  const managerARaw = await createUser('manager-a', banAId)
  const memberBRaw = await createUser('member-b', banBId)
  const boardRaw = await createUser('board', null)
  const techRaw = await createUser('tech', null)

  users.memberA = {
    ...memberARaw,
    departmentId: banAId,
    roles: [{ role: 'MEMBER', departmentId: banAId }],
  }
  users.managerA = {
    ...managerARaw,
    departmentId: banAId,
    roles: [
      { role: 'MEMBER', departmentId: banAId },
      { role: 'DEPARTMENT_MANAGER', departmentId: banAId },
    ],
  }
  users.memberB = {
    ...memberBRaw,
    departmentId: banBId,
    roles: [{ role: 'MEMBER', departmentId: banBId }],
  }
  users.board = {
    ...boardRaw,
    departmentId: null,
    roles: [{ role: 'BOARD', departmentId: null }],
  }
  users.techAdmin = {
    ...techRaw,
    departmentId: null,
    roles: [{ role: 'TECH_ADMIN', departmentId: null }],
  }

  postAllId = (await seedPost({ status: 'PUBLISHED', audience: 'ALL' })).id
  postDeptAId = (await seedPost({ status: 'PUBLISHED', audience: 'DEPARTMENT', audienceDepartmentId: banAId })).id
  postManagerOnlyId = (await seedPost({ status: 'PUBLISHED', audience: 'ROLES', audienceRoles: ['DEPARTMENT_MANAGER'] })).id
  postMemberTargetId = (await seedPost({ status: 'PUBLISHED', audience: 'ROLES', audienceRoles: ['MEMBER'] })).id
  postDraftId = (await seedPost({ status: 'DRAFT', audience: 'ALL' })).id
  postArchivedId = (await seedPost({ status: 'ARCHIVED', audience: 'ALL' })).id
})

afterAll(async () => {
  await db.post.deleteMany({ where: { id: { in: createdPostIds } } })
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  await db.department.deleteMany({ where: { id: { in: createdDeptIds } } })
  await app.close()
  await db.$disconnect()
})

// ─── GET /portal/announcements ────────────────────────────────────────────────

describe('GET /portal/announcements', () => {
  it('401 khi không đăng nhập', async () => {
    const res = await req('GET', '/portal/announcements', null)
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('unauthenticated')
  })

  it('member.a (Ban A) thấy ALL + ban A + ROLES(MEMBER) = 3 thông báo', async () => {
    const res = await req('GET', '/portal/announcements', 'memberA')
    expect(res.statusCode).toBe(200)
    const ids = res.json().items.map((item: { id: string }) => item.id)
    expect(ids).toHaveLength(3)
    expect(ids).toEqual(expect.arrayContaining([postAllId, postDeptAId, postMemberTargetId]))
  })

  it('member.b (Ban B) thấy ALL + ROLES(MEMBER) = 2 thông báo', async () => {
    const res = await req('GET', '/portal/announcements', 'memberB')
    expect(res.statusCode).toBe(200)
    const ids = res.json().items.map((item: { id: string }) => item.id)
    expect(ids).toHaveLength(2)
    expect(ids).toEqual(expect.arrayContaining([postAllId, postMemberTargetId]))
  })

  it('manager.a (Ban A + MANAGER) thấy thêm thông báo dành cho DEPARTMENT_MANAGER = 4', async () => {
    const res = await req('GET', '/portal/announcements', 'managerA')
    expect(res.statusCode).toBe(200)
    const ids = res.json().items.map((item: { id: string }) => item.id)
    expect(ids).toHaveLength(4)
    expect(ids).toEqual(
      expect.arrayContaining([postAllId, postDeptAId, postManagerOnlyId, postMemberTargetId]),
    )
  })

  it('board (không thuộc ban) chỉ thấy ALL + ROLES(MEMBER) = 2 thông báo', async () => {
    const res = await req('GET', '/portal/announcements', 'board')
    expect(res.statusCode).toBe(200)
    const ids = res.json().items.map((item: { id: string }) => item.id)
    expect(ids).toHaveLength(2)
    expect(ids).toEqual(expect.arrayContaining([postAllId, postMemberTargetId]))
    expect(ids).not.toContain(postDeptAId)
    expect(ids).not.toContain(postManagerOnlyId)
  })

  it('techAdmin không được biết thông báo nghiệp vụ → 404 (docs/02 §8.5)', async () => {
    const res = await req('GET', '/portal/announcements', 'techAdmin')
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('not_found')
  })
})

// ─── GET /portal/announcements/:id ────────────────────────────────────────────

describe('GET /portal/announcements/:id', () => {
  it('401 khi không đăng nhập', async () => {
    const res = await req('GET', `/portal/announcements/${postAllId}`, null)
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('unauthenticated')
  })

  it('member.b mở thông báo của Ban A → 404', async () => {
    const res = await req('GET', `/portal/announcements/${postDeptAId}`, 'memberB')
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('not_found')
  })

  it('member.a mở thông báo ALL → 200 kèm content', async () => {
    const res = await req('GET', `/portal/announcements/${postAllId}`, 'memberA')
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(postAllId)
    expect(res.json()).toHaveProperty('content')
    expect(res.json()).not.toHaveProperty('audience')
    expect(res.json()).not.toHaveProperty('authorId')
  })

  it('member.a mở thông báo DRAFT → 404', async () => {
    const res = await req('GET', `/portal/announcements/${postDraftId}`, 'memberA')
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('not_found')
  })

  it('member.a mở thông báo ARCHIVED → 404', async () => {
    const res = await req('GET', `/portal/announcements/${postArchivedId}`, 'memberA')
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('not_found')
  })
})

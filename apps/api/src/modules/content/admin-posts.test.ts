import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { AuthUser } from '../auth/rbac.js'

/**
 * Test tích hợp cho /admin/content/posts (Task C3.1).
 * Dùng hook onRequest x-test-user để giả lập auth — tương tự files.test.ts.
 * Postgres thật; mỗi run dùng tag UUID riêng để tránh va chạm.
 */

const ORIGIN = 'http://localhost:5173'
const tag = randomUUID().slice(0, 8)
const config = loadConfig({ NODE_ENV: 'test' })

// ─── DỮ LIỆU NGƯỜI DÙNG TEST ─────────────────────────────────────────────────

type UserKey = 'board' | 'manager' | 'otherManager' | 'member'

let dept1Id: string   // ban của manager
let dept2Id: string   // ban của otherManager
const users = {} as Record<UserKey, AuthUser>
const createdUserIds: string[] = []
const createdDeptIds: string[] = []
const createdPostIds: string[] = []
const createdConsentIds: string[] = []

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
      username: `admpost-${suffix}-${tag}`,
      email: `admpost-${suffix}-${tag}@test.local`,
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
    data: { name: `Dept ${code} ${tag}`, code: `${code}-${tag}` },
  })
  createdDeptIds.push(dept.id)
  return dept
}

/** Tạo bài viết trực tiếp qua DB. */
async function seedPost(opts: {
  authorId: string
  departmentId?: string | null
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  scope?: 'PUBLIC' | 'INTERNAL'
}) {
  const suffix = randomUUID().slice(0, 6)
  const post = await db.post.create({
    data: {
      title: `Post ${suffix}`,
      slug: `post-${suffix}-${tag}`,
      summary: 'Tóm tắt test',
      content: 'Nội dung test',
      category: 'Kiểm thử',
      status: opts.status ?? 'DRAFT',
      scope: opts.scope ?? 'PUBLIC',
      authorId: opts.authorId,
      departmentId: opts.departmentId ?? null,
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
  body?: unknown,
) {
  // Dùng any để tránh lỗi type phức tạp của Fastify inject overload (void & Promise & Chain)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (app.inject as any)({
    method,
    url,
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      ...(user ? { 'x-test-user': user } : {}),
    },
  })
  return res as { statusCode: number; json: () => any }
}


// ─── SETUP / TEARDOWN ────────────────────────────────────────────────────────

beforeAll(async () => {
  await app.ready()

  // Tạo 2 ban
  const dept1 = await createDept('D1')
  const dept2 = await createDept('D2')
  dept1Id = dept1.id
  dept2Id = dept2.id

  // Tạo users
  const boardRaw = await createUser('board', null)
  const managerRaw = await createUser('manager', dept1Id)
  const otherManagerRaw = await createUser('other-mgr', dept2Id)
  const memberRaw = await createUser('member', dept1Id)

  // Gán roles (AuthUser dùng trong hook, không cần ghi DB cho test)
  users.board = {
    ...boardRaw,
    roles: [{ role: 'BOARD', departmentId: null }],
  }
  users.manager = {
    ...managerRaw,
    departmentId: dept1Id,
    roles: [
      { role: 'MEMBER', departmentId: dept1Id },
      { role: 'DEPARTMENT_MANAGER', departmentId: dept1Id },
    ],
  }
  users.otherManager = {
    ...otherManagerRaw,
    departmentId: dept2Id,
    roles: [
      { role: 'MEMBER', departmentId: dept2Id },
      { role: 'DEPARTMENT_MANAGER', departmentId: dept2Id },
    ],
  }
  users.member = {
    ...memberRaw,
    departmentId: dept1Id,
    roles: [{ role: 'MEMBER', departmentId: dept1Id }],
  }
})

afterAll(async () => {
  // Xóa theo thứ tự phụ thuộc
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any
  await anyDb.consentRecord?.deleteMany({ where: { id: { in: createdConsentIds } } })
  await anyDb.auditLog?.deleteMany({ where: { targetType: 'POST', targetId: { in: createdPostIds } } })
  await db.post.deleteMany({ where: { id: { in: createdPostIds } } })
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  await db.department.deleteMany({ where: { id: { in: createdDeptIds } } })
  await app.close()
  await db.$disconnect()
})

// ─── GET /admin/content/posts ─────────────────────────────────────────────────

describe('GET /admin/content/posts', () => {
  it('401 khi không đăng nhập', async () => {
    const res = await req('GET', '/admin/content/posts', null)
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('unauthenticated')
  })

  it('403 khi MEMBER thường gọi', async () => {
    const res = await req('GET', '/admin/content/posts', 'member')
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('forbidden')
  })

  it('BOARD thấy tất cả bài (bao gồm bài của ban khác)', async () => {
    await seedPost({ authorId: users.board.id, departmentId: dept1Id })
    await seedPost({ authorId: users.manager.id, departmentId: dept1Id })

    const res = await req('GET', '/admin/content/posts', 'board')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ items: expect.any(Array), total: expect.any(Number), page: 1, pageSize: 20 })
    // Bài viết admin phải có trường status và scope
    if (body.items.length > 0) {
      expect(body.items[0]).toHaveProperty('status')
      expect(body.items[0]).toHaveProperty('scope')
      expect(body.items[0]).not.toHaveProperty('content') // content chỉ ở detail
    }
  })

  it('DEPARTMENT_MANAGER chỉ thấy bài của ban mình', async () => {
    const myPost = await seedPost({ authorId: users.manager.id, departmentId: dept1Id })
    const otherPost = await seedPost({ authorId: users.otherManager.id, departmentId: dept2Id })

    const res = await req('GET', '/admin/content/posts', 'manager')
    expect(res.statusCode).toBe(200)
    const slugs = res.json().items.map((i: { id: string }) => i.id)
    expect(slugs).toContain(myPost.id)
    expect(slugs).not.toContain(otherPost.id)
  })

  it('lọc đúng theo status', async () => {
    await seedPost({ authorId: users.board.id, departmentId: null, status: 'DRAFT' })
    const res = await req('GET', '/admin/content/posts?status=DRAFT', 'board')
    expect(res.statusCode).toBe(200)
    for (const item of res.json().items) {
      expect(item.status).toBe('DRAFT')
    }
  })
})

// ─── GET /admin/content/posts/:id ────────────────────────────────────────────

describe('GET /admin/content/posts/:id', () => {
  it('401 khi không đăng nhập', async () => {
    const post = await seedPost({ authorId: users.board.id })
    const res = await req('GET', `/admin/content/posts/${post.id}`, null)
    expect(res.statusCode).toBe(401)
  })

  it('404 khi DEPARTMENT_MANAGER xem bài ngoài phạm vi ban', async () => {
    // Bài của dept2, otherManager sở hữu; manager của dept1 không được xem
    const post = await seedPost({ authorId: users.otherManager.id, departmentId: dept2Id })
    const res = await req('GET', `/admin/content/posts/${post.id}`, 'manager')
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('not_found')
  })

  it('BOARD thấy bài của mọi ban', async () => {
    const post = await seedPost({ authorId: users.manager.id, departmentId: dept1Id })
    const res = await req('GET', `/admin/content/posts/${post.id}`, 'board')
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(post.id)
    // Detail có trường content
    expect(res.json()).toHaveProperty('content')
  })

  it('DEPARTMENT_MANAGER thấy bài của ban mình', async () => {
    const post = await seedPost({ authorId: users.manager.id, departmentId: dept1Id })
    const res = await req('GET', `/admin/content/posts/${post.id}`, 'manager')
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(post.id)
  })

  it('404 khi id không tồn tại', async () => {
    const res = await req('GET', `/admin/content/posts/non-existent-id`, 'board')
    expect(res.statusCode).toBe(404)
  })
})

// ─── POST /admin/content/posts ────────────────────────────────────────────────

describe('POST /admin/content/posts', () => {
  const validBody = {
    title: `Bài mới tạo ${tag}`,
    summary: 'Tóm tắt bài viết mới',
    content: 'Nội dung chi tiết bài viết mới.',
    category: 'Thông báo',
    scope: 'PUBLIC',
  }

  it('401 khi không đăng nhập', async () => {
    const res = await req('POST', '/admin/content/posts', null, validBody)
    expect(res.statusCode).toBe(401)
  })

  it('403 khi MEMBER gọi', async () => {
    const res = await req('POST', '/admin/content/posts', 'member', validBody)
    expect(res.statusCode).toBe(403)
  })

  it('BOARD tạo bài mới thành công (status DRAFT, departmentId null)', async () => {
    const res = await req('POST', '/admin/content/posts', 'board', {
      ...validBody,
      title: `Board Post ${tag}`,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.status).toBe('DRAFT')
    expect(body.departmentId).toBeNull()
    expect(body.authorId).toBe(users.board.id)
    expect(body).toHaveProperty('slug')
    expect(body).toHaveProperty('updatedAt')
    createdPostIds.push(body.id)
  })

  it('DEPARTMENT_MANAGER tạo bài — departmentId tự gán theo ban mình', async () => {
    const res = await req('POST', '/admin/content/posts', 'manager', {
      ...validBody,
      title: `Manager Post ${tag}`,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.status).toBe('DRAFT')
    expect(body.departmentId).toBe(dept1Id)
    createdPostIds.push(body.id)
  })

  it('422 khi thiếu trường bắt buộc (title)', async () => {
    const res = await req('POST', '/admin/content/posts', 'board', {
      summary: 'test',
      content: 'test',
      category: 'test',
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error).toBe('validation')
  })

  it('tự sinh slug từ title, trùng thì thêm hậu tố', async () => {
    // Tạo bài trùng title để test hậu tố
    const sameTitle = `Same Title For Slug Test ${tag}`
    const res1 = await req('POST', '/admin/content/posts', 'board', { ...validBody, title: sameTitle })
    const res2 = await req('POST', '/admin/content/posts', 'board', { ...validBody, title: sameTitle })
    expect(res1.statusCode).toBe(201)
    expect(res2.statusCode).toBe(201)
    // Hai slug phải khác nhau
    expect(res1.json().slug).not.toBe(res2.json().slug)
    createdPostIds.push(res1.json().id, res2.json().id)
  })
})

// ─── PATCH /admin/content/posts/:id ──────────────────────────────────────────

describe('PATCH /admin/content/posts/:id', () => {
  it('401 khi không đăng nhập', async () => {
    const post = await seedPost({ authorId: users.board.id })
    const res = await req('PATCH', `/admin/content/posts/${post.id}`, null, {
      summary: 'mới',
      updatedAt: post.updatedAt.toISOString(),
    })
    expect(res.statusCode).toBe(401)
  })

  it('404 khi DEPARTMENT_MANAGER sửa bài ngoài phạm vi', async () => {
    const post = await seedPost({ authorId: users.otherManager.id, departmentId: dept2Id })
    const res = await req('PATCH', `/admin/content/posts/${post.id}`, 'manager', {
      summary: 'mới',
      updatedAt: post.updatedAt.toISOString(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('403 khi DEPARTMENT_MANAGER sửa bài đã PUBLISHED', async () => {
    const post = await seedPost({ authorId: users.manager.id, departmentId: dept1Id, status: 'PUBLISHED' })
    const res = await req('PATCH', `/admin/content/posts/${post.id}`, 'manager', {
      summary: 'mới',
      updatedAt: post.updatedAt.toISOString(),
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('forbidden')
  })

  it('409 khi updatedAt không khớp (OCC conflict)', async () => {
    const post = await seedPost({ authorId: users.board.id, departmentId: null })
    // Gửi updatedAt sai (timestamp cũ hơn)
    const staleTimestamp = new Date(post.updatedAt.getTime() - 5000).toISOString()
    const res = await req('PATCH', `/admin/content/posts/${post.id}`, 'board', {
      summary: 'cập nhật',
      updatedAt: staleTimestamp,
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe('conflict')
  })

  it('BOARD cập nhật bài thành công (bao gồm bài PUBLISHED)', async () => {
    const post = await seedPost({ authorId: users.board.id, status: 'PUBLISHED', departmentId: null })
    const res = await req('PATCH', `/admin/content/posts/${post.id}`, 'board', {
      summary: 'Tóm tắt đã sửa',
      updatedAt: post.updatedAt.toISOString(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().summary).toBe('Tóm tắt đã sửa')
  })

  it('DEPARTMENT_MANAGER sửa bài DRAFT của ban mình thành công', async () => {
    const post = await seedPost({ authorId: users.manager.id, departmentId: dept1Id, status: 'DRAFT' })
    const res = await req('PATCH', `/admin/content/posts/${post.id}`, 'manager', {
      category: 'Tin mới',
      updatedAt: post.updatedAt.toISOString(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().category).toBe('Tin mới')
  })
})

// ─── PATCH /admin/content/posts/:id/status ───────────────────────────────────

describe('PATCH /admin/content/posts/:id/status', () => {
  it('401 khi không đăng nhập', async () => {
    const post = await seedPost({ authorId: users.board.id })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, null, { action: 'PUBLISH' })
    expect(res.statusCode).toBe(401)
  })

  it('403 khi MEMBER gọi', async () => {
    const post = await seedPost({ authorId: users.board.id })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'member', { action: 'PUBLISH' })
    expect(res.statusCode).toBe(403)
  })

  it('404 khi DEPARTMENT_MANAGER thao tác bài ngoài phạm vi', async () => {
    const post = await seedPost({ authorId: users.otherManager.id, departmentId: dept2Id })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'manager', { action: 'PUBLISH' })
    expect(res.statusCode).toBe(404)
  })

  // ── State machine ───────────────────────────────────────────────────────────

  it('BOARD publish bài DRAFT → PUBLISHED thành công', async () => {
    const post = await seedPost({ authorId: users.board.id, status: 'DRAFT', departmentId: null })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'board', { action: 'PUBLISH' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('PUBLISHED')
    // Kiểm tra DB: publishedAt và publishedById được gán
    const updated = await db.post.findUnique({ where: { id: post.id }, select: { publishedAt: true, publishedById: true, status: true } })
    expect(updated?.status).toBe('PUBLISHED')
    expect(updated?.publishedAt).not.toBeNull()
    expect(updated?.publishedById).toBe(users.board.id)
  })

  it('409 khi PUBLISH bài đã PUBLISHED (state machine sai bước)', async () => {
    const post = await seedPost({ authorId: users.board.id, status: 'PUBLISHED', departmentId: null })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'board', { action: 'PUBLISH' })
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe('conflict')
  })

  it('BOARD unpublish PUBLISHED → DRAFT thành công', async () => {
    const post = await seedPost({ authorId: users.board.id, status: 'PUBLISHED', departmentId: null })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'board', { action: 'UNPUBLISH' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('DRAFT')
  })

  it('409 khi UNPUBLISH bài DRAFT (sai bước chuyển)', async () => {
    const post = await seedPost({ authorId: users.board.id, status: 'DRAFT', departmentId: null })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'board', { action: 'UNPUBLISH' })
    expect(res.statusCode).toBe(409)
  })

  it('BOARD archive bài DRAFT → ARCHIVED thành công', async () => {
    const post = await seedPost({ authorId: users.board.id, status: 'DRAFT', departmentId: null })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'board', { action: 'ARCHIVE' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ARCHIVED')
  })

  it('409 khi ARCHIVE bài đã ARCHIVED', async () => {
    const post = await seedPost({ authorId: users.board.id, status: 'ARCHIVED', departmentId: null })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'board', { action: 'ARCHIVE' })
    expect(res.statusCode).toBe(409)
  })

  // ── RBAC cho trạng thái ─────────────────────────────────────────────────────

  it('403 khi DEPARTMENT_MANAGER publish bài PUBLIC (phải là BOARD)', async () => {
    const post = await seedPost({
      authorId: users.manager.id,
      departmentId: dept1Id,
      status: 'DRAFT',
      scope: 'PUBLIC',
    })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'manager', { action: 'PUBLISH' })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('forbidden')
  })

  it('DEPARTMENT_MANAGER publish bài INTERNAL của ban mình thành công', async () => {
    const post = await seedPost({
      authorId: users.manager.id,
      departmentId: dept1Id,
      status: 'DRAFT',
      scope: 'INTERNAL',
    })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'manager', { action: 'PUBLISH' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('PUBLISHED')
  })

  it('403 khi DEPARTMENT_MANAGER archive bài PUBLIC', async () => {
    const post = await seedPost({
      authorId: users.manager.id,
      departmentId: dept1Id,
      status: 'PUBLISHED',
      scope: 'PUBLIC',
    })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'manager', { action: 'ARCHIVE' })
    expect(res.statusCode).toBe(403)
  })

  // ── Consent check ───────────────────────────────────────────────────────────

  it('400 missing_consent khi PUBLISH với mentionedUserId chưa có consent', async () => {
    const post = await seedPost({ authorId: users.board.id, status: 'DRAFT', departmentId: null })
    // userId ngẫu nhiên, không có consent
    const fakeUserId = randomUUID()
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'board', {
      action: 'PUBLISH',
      mentionedUserIds: [fakeUserId],
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('missing_consent')
    expect(res.json().missingConsentUserIds).toContain(fakeUserId)
    // Bài không được publish
    const dbPost = await db.post.findUnique({ where: { id: post.id }, select: { status: true } })
    expect(dbPost?.status).toBe('DRAFT')
  })

  it('PUBLISH thành công khi tất cả mentionedUserIds đều có consent PUBLIC_NAME', async () => {
    // Tạo user thật và gắn consent PUBLIC_NAME
    const consentUser = await db.user.create({
      data: {
        username: `consent-user-${tag}`,
        email: `consent-user-${tag}@test.local`,
        passwordHash: 'dummy',
        fullName: 'Consent User',
        mustChangePassword: false,
        status: 'ACTIVE',
      },
    })
    createdUserIds.push(consentUser.id)

    const consentRecord = await (db as any).consentRecord.create({
      data: {
        subjectType: 'USER',
        subjectId: consentUser.id,
        purpose: 'PUBLIC_NAME',
        policyVersion: '2026-10',
      },
    })
    createdConsentIds.push(consentRecord.id)

    const post = await seedPost({ authorId: users.board.id, status: 'DRAFT', departmentId: null })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'board', {
      action: 'PUBLISH',
      mentionedUserIds: [consentUser.id],
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('PUBLISHED')
  })

  it('PUBLISH không có mentionedUserIds thành công (consent skip)', async () => {
    const post = await seedPost({ authorId: users.board.id, status: 'DRAFT', departmentId: null })
    const res = await req('PATCH', `/admin/content/posts/${post.id}/status`, 'board', { action: 'PUBLISH' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('PUBLISHED')
  })

  it('kiểm tra audit log được ghi khi PUBLISH', async () => {
    const post = await seedPost({ authorId: users.board.id, status: 'DRAFT', departmentId: null })
    await req('PATCH', `/admin/content/posts/${post.id}/status`, 'board', { action: 'PUBLISH' })
    // Audit log phải tồn tại
    const auditEntry = await (db as any).auditLog?.findFirst({
      where: { targetType: 'POST', targetId: post.id, action: 'post.publish' },
    })
    expect(auditEntry).not.toBeNull()
    expect(auditEntry?.result).toBe('SUCCESS')
  })
})

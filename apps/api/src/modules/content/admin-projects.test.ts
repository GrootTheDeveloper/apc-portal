import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { PRIVACY_POLICY_VERSION } from '../consent/service.js'
import type { AuthUser } from '../auth/rbac.js'

/**
 * Test tích hợp cho /admin/content/projects (Task C4 / P3).
 * Dùng hook onRequest x-test-user để giả lập auth — tương tự admin-posts.test.ts.
 * Postgres thật; mỗi run dùng tag UUID riêng để tránh va chạm.
 */

const ORIGIN = 'http://localhost:5173'
const tag = randomUUID().slice(0, 8)
const config = loadConfig({ NODE_ENV: 'test' })

// ─── DỮ LIỆU NGƯỜI DÙNG TEST ─────────────────────────────────────────────────

type UserKey = 'board' | 'manager' | 'otherManager' | 'member'

let dept1Id: string // ban của manager
let dept2Id: string // ban của otherManager
const users = {} as Record<UserKey, AuthUser>
const createdUserIds: string[] = []
const createdDeptIds: string[] = []
const createdProjectIds: string[] = []
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
  status: 'ACTIVE' | 'PENDING_ACTIVATION' = 'ACTIVE',
): Promise<AuthUser> {
  const user = await db.user.create({
    data: {
      username: `admprj-${suffix}-${tag}`,
      email: `admprj-${suffix}-${tag}@test.local`,
      passwordHash: 'dummy',
      fullName: `Test ${suffix}`,
      mustChangePassword: false,
      status,
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

/** Tạo dự án trực tiếp qua DB. */
async function seedProject(opts: {
  createdById: string
  departmentId?: string | null
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  type?: 'PROJECT' | 'PRODUCT'
  thumbnailUrl?: string | null
}) {
  const suffix = randomUUID().slice(0, 6)
  const project = await db.project.create({
    data: {
      title: `Project ${suffix}`,
      slug: `project-${suffix}-${tag}`,
      description: 'Mô tả test',
      type: opts.type ?? 'PROJECT',
      status: opts.status ?? 'DRAFT',
      createdById: opts.createdById,
      departmentId: opts.departmentId ?? null,
      thumbnailUrl: opts.thumbnailUrl ?? null,
      publishedAt: opts.status === 'PUBLISHED' ? new Date() : null,
    },
  })
  createdProjectIds.push(project.id)
  return project
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
  await db.consentRecord.deleteMany({ where: { id: { in: createdConsentIds } } })
  await db.projectMember.deleteMany({ where: { projectId: { in: createdProjectIds } } })
  await db.project.deleteMany({ where: { id: { in: createdProjectIds } } })
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  await db.department.deleteMany({ where: { id: { in: createdDeptIds } } })
  await app.close()
  await db.$disconnect()
})

// ─── GET /admin/content/projects ──────────────────────────────────────────────

describe('GET /admin/content/projects', () => {
  it('401 khi không đăng nhập', async () => {
    const res = await req('GET', '/admin/content/projects', null)
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('unauthenticated')
  })

  it('403 khi MEMBER thường gọi', async () => {
    const res = await req('GET', '/admin/content/projects', 'member')
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('forbidden')
  })

  it('DEPARTMENT_MANAGER chỉ thấy dự án của ban mình', async () => {
    const mine = await seedProject({ createdById: users.manager.id, departmentId: dept1Id })
    const other = await seedProject({ createdById: users.otherManager.id, departmentId: dept2Id })

    const res = await req('GET', '/admin/content/projects', 'manager')
    expect(res.statusCode).toBe(200)
    const ids = res.json().items.map((i: { id: string }) => i.id)
    expect(ids).toContain(mine.id)
    expect(ids).not.toContain(other.id)
  })

  it('lọc đúng theo type', async () => {
    await seedProject({ createdById: users.board.id, departmentId: null, type: 'PRODUCT' })
    const res = await req('GET', '/admin/content/projects?type=PRODUCT', 'board')
    expect(res.statusCode).toBe(200)
    for (const item of res.json().items) {
      expect(item.type).toBe('PRODUCT')
    }
  })
})

// ─── POST /admin/content/projects ─────────────────────────────────────────────

describe('POST /admin/content/projects', () => {
  const validBody = {
    type: 'PROJECT',
    title: `Dự án mới ${tag}`,
    description: 'Mô tả dự án mới.',
    technologies: ['React', 'Node.js'],
  }

  it('401 khi không đăng nhập', async () => {
    const res = await req('POST', '/admin/content/projects', null, validBody)
    expect(res.statusCode).toBe(401)
  })

  it('403 khi MEMBER gọi', async () => {
    const res = await req('POST', '/admin/content/projects', 'member', validBody)
    expect(res.statusCode).toBe(403)
  })

  it('BOARD tạo với 2 member ACTIVE → 201, DB có 2 dòng ProjectMember', async () => {
    const memberA = await createUser('member-a', dept1Id)
    const memberB = await createUser('member-b', dept1Id)

    const res = await req('POST', '/admin/content/projects', 'board', {
      ...validBody,
      title: `Board Project ${tag}`,
      memberIds: [memberA.id, memberB.id],
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.status).toBe('DRAFT')
    expect(body.departmentId).toBeNull()
    expect(body.createdById).toBe(users.board.id)
    expect(body).toHaveProperty('slug')
    createdProjectIds.push(body.id)

    const rows = await db.projectMember.findMany({ where: { projectId: body.id } })
    expect(rows).toHaveLength(2)
    const memberIds = rows.map((r) => r.userId).sort()
    expect(memberIds).toEqual([memberA.id, memberB.id].sort())
  })

  it('MANAGER gửi departmentId = ban B → DB vẫn lưu ban của mình (ban A)', async () => {
    const res = await req('POST', '/admin/content/projects', 'manager', {
      ...validBody,
      title: `Manager Project ${tag}`,
      departmentId: dept2Id,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.departmentId).toBe(dept1Id)
    createdProjectIds.push(body.id)

    const saved = await db.project.findUnique({ where: { id: body.id }, select: { departmentId: true } })
    expect(saved?.departmentId).toBe(dept1Id)
  })

  it('422 khi memberIds chứa id không phải user ACTIVE', async () => {
    const pendingUser = await createUser('pending', dept1Id, 'PENDING_ACTIVATION')
    const res = await req('POST', '/admin/content/projects', 'board', {
      ...validBody,
      title: `Member check ${tag}`,
      memberIds: [pendingUser.id],
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error).toBe('validation')
    // Lỗi nằm trong issues, liệt kê id sai
    const issues = res.json().issues as { path: (string | number)[]; message: string }[]
    const memberIssue = issues.find((i) => i.path.includes('memberIds'))
    expect(memberIssue?.message).toContain(pendingUser.id)
  })

  it('422 khi thumbnailUrl là cuid không tồn tại trong stored_files', async () => {
    // dept1Id là cuid thật nhưng không phải id tệp
    const res = await req('POST', '/admin/content/projects', 'board', {
      ...validBody,
      title: `Thumb check ${tag}`,
      thumbnailUrl: dept1Id,
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error).toBe('validation')
    const issues = res.json().issues as { path: (string | number)[] }[]
    expect(issues.some((i) => i.path.includes('thumbnailUrl'))).toBe(true)
  })
})

// ─── PATCH /admin/content/projects/:id ────────────────────────────────────────

describe('PATCH /admin/content/projects/:id', () => {
  it('401 khi không đăng nhập', async () => {
    const project = await seedProject({ createdById: users.board.id })
    const res = await req('PATCH', `/admin/content/projects/${project.id}`, null, {
      description: 'mới',
      updatedAt: project.updatedAt.toISOString(),
    })
    expect(res.statusCode).toBe(401)
  })

  it('404 khi MANAGER mở dự án ban B', async () => {
    const project = await seedProject({ createdById: users.otherManager.id, departmentId: dept2Id })
    const res = await req('PATCH', `/admin/content/projects/${project.id}`, 'manager', {
      description: 'mới',
      updatedAt: project.updatedAt.toISOString(),
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('not_found')
  })

  it('403 khi MANAGER sửa dự án đã PUBLISHED của ban mình', async () => {
    const project = await seedProject({
      createdById: users.manager.id,
      departmentId: dept1Id,
      status: 'PUBLISHED',
    })
    const res = await req('PATCH', `/admin/content/projects/${project.id}`, 'manager', {
      description: 'mới',
      updatedAt: project.updatedAt.toISOString(),
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('forbidden')
  })

  it('409 khi updatedAt không khớp (OCC conflict)', async () => {
    const project = await seedProject({ createdById: users.board.id, departmentId: null })
    const staleTimestamp = new Date(project.updatedAt.getTime() - 5000).toISOString()
    const res = await req('PATCH', `/admin/content/projects/${project.id}`, 'board', {
      description: 'cập nhật',
      updatedAt: staleTimestamp,
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe('conflict')
  })

  it('đổi title thành công nhưng slug KHÔNG đổi', async () => {
    const project = await seedProject({ createdById: users.board.id, departmentId: null })
    const slugBefore = project.slug
    const res = await req('PATCH', `/admin/content/projects/${project.id}`, 'board', {
      title: 'Tên hoàn toàn mới',
      updatedAt: project.updatedAt.toISOString(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Tên hoàn toàn mới')
    expect(res.json().slug).toBe(slugBefore)

    const saved = await db.project.findUnique({ where: { id: project.id }, select: { slug: true } })
    expect(saved?.slug).toBe(slugBefore)
  })

  it('422 khi projectUrl là javascript:alert(1)', async () => {
    const project = await seedProject({ createdById: users.board.id, departmentId: null })
    const res = await req('PATCH', `/admin/content/projects/${project.id}`, 'board', {
      projectUrl: 'javascript:alert(1)',
      updatedAt: project.updatedAt.toISOString(),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error).toBe('validation')
  })

  it('422 khi projectUrl là ftp://x', async () => {
    const project = await seedProject({ createdById: users.board.id, departmentId: null })
    const res = await req('PATCH', `/admin/content/projects/${project.id}`, 'board', {
      projectUrl: 'ftp://x',
      updatedAt: project.updatedAt.toISOString(),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error).toBe('validation')
  })

  it('xóa ảnh bằng thumbnailUrl: "" → DB lưu null', async () => {
    const project = await seedProject({
      createdById: users.board.id,
      departmentId: null,
      thumbnailUrl: 'file-id-cu',
    })
    const res = await req('PATCH', `/admin/content/projects/${project.id}`, 'board', {
      thumbnailUrl: '',
      updatedAt: project.updatedAt.toISOString(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().thumbnailUrl).toBeNull()
    const saved = await db.project.findUnique({ where: { id: project.id }, select: { thumbnailUrl: true } })
    expect(saved?.thumbnailUrl).toBeNull()
  })
})

// ─── GET /admin/content/projects/:id ──────────────────────────────────────────

describe('GET /admin/content/projects/:id', () => {
  it('401 khi không đăng nhập', async () => {
    const project = await seedProject({ createdById: users.board.id })
    const res = await req('GET', `/admin/content/projects/${project.id}`, null)
    expect(res.statusCode).toBe(401)
  })

  it('404 khi MANAGER mở dự án ban B', async () => {
    const project = await seedProject({ createdById: users.otherManager.id, departmentId: dept2Id })
    const res = await req('GET', `/admin/content/projects/${project.id}`, 'manager')
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('not_found')
  })

  it('detail trả members với publicNameConsent/publicPhotoConsent đúng', async () => {
    const project = await seedProject({ createdById: users.manager.id, departmentId: dept1Id })
    // memberA: đồng ý riêng cho dự án này; memberB: chỉ đồng ý chung PUBLIC_NAME
    const memberA = await createUser('consent-a', dept1Id)
    const memberB = await createUser('consent-b', dept1Id)

    await db.projectMember.createMany({
      data: [
        { projectId: project.id, userId: memberA.id },
        { projectId: project.id, userId: memberB.id },
      ],
    })

    const consentA1 = await db.consentRecord.create({
      data: {
        subjectType: 'USER',
        subjectId: memberA.id,
        purpose: 'PUBLIC_NAME',
        targetType: 'PROJECT',
        targetId: project.id,
        policyVersion: PRIVACY_POLICY_VERSION,
      },
    })
    const consentA2 = await db.consentRecord.create({
      data: {
        subjectType: 'USER',
        subjectId: memberA.id,
        purpose: 'PUBLIC_PHOTO',
        targetType: 'PROJECT',
        targetId: project.id,
        policyVersion: PRIVACY_POLICY_VERSION,
      },
    })
    const consentB = await db.consentRecord.create({
      data: {
        subjectType: 'USER',
        subjectId: memberB.id,
        purpose: 'PUBLIC_NAME',
        policyVersion: PRIVACY_POLICY_VERSION,
      },
    })
    createdConsentIds.push(consentA1.id, consentA2.id, consentB.id)

    const res = await req('GET', `/admin/content/projects/${project.id}`, 'board')
    expect(res.statusCode).toBe(200)
    const members = res.json().members as {
      userId: string
      name: string
      publicNameConsent: boolean
      publicPhotoConsent: boolean
    }[]
    expect(members).toHaveLength(2)

    const a = members.find((m) => m.userId === memberA.id)
    const b = members.find((m) => m.userId === memberB.id)
    expect(a).toMatchObject({ publicNameConsent: true, publicPhotoConsent: true })
    expect(a?.name).toBe(`Test consent-a`)
    expect(b).toMatchObject({ publicNameConsent: true, publicPhotoConsent: false })
  })
})

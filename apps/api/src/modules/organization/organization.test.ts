import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { AuthUser } from '../auth/rbac.js'
import { AUDIT_ACTIONS } from '../audit/service.js'

const config = loadConfig({ NODE_ENV: 'test' })
const ORIGIN = 'http://localhost:5173'
const tag = randomUUID().slice(0, 8)

type UserKey = 'board' | 'manager' | 'member'
const users = {} as Record<UserKey, AuthUser>
const userIds: string[] = []
const departmentIds: string[] = []
const postIds: string[] = []
const eventIds: string[] = []
const projectIds: string[] = []

let app: ReturnType<typeof buildApp>
let deptActive1 = ''
let deptActive2 = ''

async function get(user: UserKey | null, url: string) {
  return app.inject({
    method: 'GET',
    url,
    headers: user ? { 'x-test-user': user } : {},
  })
}

async function post(user: UserKey | null, url: string, payload?: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url,
    ...(payload && { payload }),
    headers: { origin: ORIGIN, ...(user ? { 'x-test-user': user } : {}) },
  })
}

async function put(user: UserKey | null, url: string, payload?: Record<string, unknown>) {
  return app.inject({
    method: 'PUT',
    url,
    ...(payload && { payload }),
    headers: { origin: ORIGIN, ...(user ? { 'x-test-user': user } : {}) },
  })
}

async function patchReq(user: UserKey | null, url: string, payload?: Record<string, unknown>) {
  return app.inject({
    method: 'PATCH',
    url,
    ...(payload && { payload }),
    headers: { origin: ORIGIN, ...(user ? { 'x-test-user': user } : {}) },
  })
}

beforeAll(async () => {
  app = buildApp(config)
  app.addHook('onRequest', async (request) => {
    const key = request.headers['x-test-user'] as UserKey | undefined
    request.user = key && users[key] ? users[key] : null
  })
  await app.ready()

  // Đảm bảo SiteSetting singleton tồn tại với dữ liệu test
  await db.siteSetting.upsert({
    where: { id: 'singleton' },
    update: {
      info: {
        name: 'APC Test',
        description: 'Mô tả ban đầu',
        mission: 'Sứ mệnh ban đầu',
        contactEmail: 'contact@apc.test',
        fanpage: 'https://facebook.com/apc.test',
        officialLinks: [{ label: 'UMT', url: 'https://umt.edu.vn' }],
      },
      termEndsAt: new Date('2027-06-01T00:00:00Z'),
    },
    create: {
      id: 'singleton',
      info: {
        name: 'APC Test',
        description: 'Mô tả ban đầu',
        mission: 'Sứ mệnh ban đầu',
        contactEmail: 'contact@apc.test',
        fanpage: 'https://facebook.com/apc.test',
        officialLinks: [{ label: 'UMT', url: 'https://umt.edu.vn' }],
      },
      termEndsAt: new Date('2027-06-01T00:00:00Z'),
    },
  })

  // Tạo 2 ban mẫu
  const [d1, d2] = await Promise.all([
    db.department.create({
      data: {
        name: `Ban Chuyên Môn 1 ${tag}`,
        code: `bcm1-${tag}`,
        contactPoint: 'bcm1@test.local',
        status: 'ACTIVE',
        order: 10,
      },
    }),
    db.department.create({
      data: {
        name: `Ban Chuyên Môn 2 ${tag}`,
        code: `bcm2-${tag}`,
        contactPoint: 'bcm2@test.local',
        status: 'ACTIVE',
        order: 20,
      },
    }),
  ])
  deptActive1 = d1.id
  deptActive2 = d2.id
  departmentIds.push(d1.id, d2.id)

  // Tạo users
  const mkUser = async (key: UserKey, departmentId: string | null, roles: Array<{ role: any; departmentId: string | null }>) => {
    const user = await db.user.create({
      data: {
        username: `org-${key}-${tag}`,
        email: `org-${key}-${tag}@test.local`,
        passwordHash: 'khong-dung',
        fullName: `User ${key} ${tag}`,
        studentId: `SV${randomUUID().slice(0, 6)}`,
        departmentId,
        memberStatus: 'ACTIVE',
        mustChangePassword: false,
      },
    })
    userIds.push(user.id)
    users[key] = {
      id: user.id,
      departmentId,
      roles: [{ role: 'MEMBER', departmentId }, ...roles],
    }
    return user
  }

  await mkUser('board', null, [{ role: 'BOARD', departmentId: null }])
  await mkUser('manager', deptActive1, [{ role: 'DEPARTMENT_MANAGER', departmentId: deptActive1 }])
  await mkUser('member', deptActive1, [])
})

afterAll(async () => {
  if (postIds.length) await db.post.deleteMany({ where: { id: { in: postIds } } })
  if (eventIds.length) await db.event.deleteMany({ where: { id: { in: eventIds } } })
  if (projectIds.length) await db.project.deleteMany({ where: { id: { in: projectIds } } })
  if (userIds.length) {
    await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } })
    await db.user.deleteMany({ where: { id: { in: userIds } } })
  }
  await db.auditLog.deleteMany({ where: { targetId: 'singleton' } })
  if (departmentIds.length) await db.department.deleteMany({ where: { id: { in: departmentIds } } })
  await app.close()
})

describe('T4 - Phân quyền quản trị thông tin APC', () => {
  it('Chưa đăng nhập gọi API admin nhận 401 unauthenticated', async () => {
    const res = await get(null, '/admin/organization/profile')
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('unauthenticated')
  })

  it('manager.a gọi API admin nhận 403 forbidden', async () => {
    const res = await get('manager', '/admin/organization/profile')
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('forbidden')

    const resDept = await get('manager', '/admin/organization/departments')
    expect(resDept.statusCode).toBe(403)

    const resFeatured = await get('manager', '/admin/organization/featured-content')
    expect(resFeatured.statusCode).toBe(403)
  })
})

describe('T4 - Quản lý thông tin APC & termEndsAt (/admin/organization/profile)', () => {
  it('BOARD xem thông tin APC và termEndsAt', async () => {
    const res = await get('board', '/admin/organization/profile')
    expect(res.statusCode).toBe(200)
    const data = res.json()
    expect(data.name).toBe('APC Test')
    expect(data.termEndsAt).toBeTruthy()
  })

  it('Link javascript:... bị từ chối lưu (422 validation)', async () => {
    const res = await put('board', '/admin/organization/profile', {
      name: 'APC Hack',
      description: 'Mô tả',
      mission: 'Sứ mệnh',
      contactEmail: 'contact@apc.test',
      fanpage: 'javascript:alert(1)',
      officialLinks: [],
    })
    expect(res.statusCode).toBe(422)
  })

  it('Cập nhật thông tin APC & termEndsAt thành công, có ghi audit log và GET /public/about không lộ termEndsAt', async () => {
    const newTerm = new Date('2028-01-01T00:00:00.000Z').toISOString()
    const updateRes = await put('board', '/admin/organization/profile', {
      name: `APC Đổi Tên ${tag}`,
      description: 'Mô tả mới',
      mission: 'Sứ mệnh mới',
      contactEmail: 'new-contact@apc.test',
      fanpage: 'https://facebook.com/apc.updated',
      officialLinks: [{ label: 'Trang chủ UMT', url: 'https://umt.edu.vn' }],
      termEndsAt: newTerm,
    })
    expect(updateRes.statusCode).toBe(200)
    expect(updateRes.json().name).toBe(`APC Đổi Tên ${tag}`)
    expect(updateRes.json().termEndsAt).toBe(newTerm)

    // Kiểm tra dòng audit log được ghi
    const auditLog = await db.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.ORG_UPDATE_INFO,
        targetType: 'SITE_SETTING',
        targetId: 'singleton',
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(auditLog).toBeTruthy()
    expect(auditLog?.actorId).toBe(users.board.id)

    // Kiểm tra GET /public/about không trả termEndsAt
    const aboutRes = await app.inject({ method: 'GET', url: '/public/about' })
    expect(aboutRes.statusCode).toBe(200)
    expect(aboutRes.json()).not.toHaveProperty('termEndsAt')
    expect(aboutRes.json().name).toBe(`APC Đổi Tên ${tag}`)
  })
})

describe('T4 - Quản lý Ban chuyên môn (/admin/organization/departments)', () => {
  it('Tạo ban trùng tên một ban đang hoạt động bị từ chối (409 Conflict)', async () => {
    const res = await post('board', '/admin/organization/departments', {
      name: `Ban Chuyên Môn 1 ${tag}`, // Trùng với deptActive1
      contactPoint: 'test@dup.com',
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe('conflict')
  })

  it('Tạo ban mới thành công có ghi audit log', async () => {
    const res = await post('board', '/admin/organization/departments', {
      name: `Ban Mới ${tag}`,
      description: 'Mô tả ban mới',
      contactPoint: 'newdept@test.local',
    })
    expect(res.statusCode).toBe(200)
    const dept = res.json()
    departmentIds.push(dept.id)
    expect(dept.name).toBe(`Ban Mới ${tag}`)

    const auditLog = await db.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.ORG_UPDATE_DEPARTMENTS,
        targetType: 'DEPARTMENT',
        targetId: dept.id,
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(auditLog).toBeTruthy()
  })

  it('Đổi thứ tự ban thì /about hiện đúng thứ tự mới', async () => {
    // Đảo thứ tự: deptActive2 lên trước deptActive1
    const res = await put('board', '/admin/organization/departments/order', {
      departmentIds: [deptActive2, deptActive1],
    })
    expect(res.statusCode).toBe(200)

    const aboutRes = await app.inject({ method: 'GET', url: '/public/about' })
    const depts = aboutRes.json().departments as Array<{ id: string; order: number }>
    const index1 = depts.findIndex((d) => d.id === deptActive1)
    const index2 = depts.findIndex((d) => d.id === deptActive2)
    expect(index2).toBeLessThan(index1)
  })

  it('Không lưu trữ được ban còn thành viên đang hoạt động; thông báo trả 409 kèm danh sách thành viên (FLOW-24)', async () => {
    // deptActive1 có thành viên users.member (memberStatus = 'ACTIVE')
    const res = await patchReq('board', `/admin/organization/departments/${deptActive1}`, {
      status: 'ARCHIVED',
    })
    expect(res.statusCode).toBe(409)
    const body = res.json()
    expect(body.error).toBe('conflict')
    expect(body.message).toContain('Không thể lưu trữ ban còn thành viên đang hoạt động')
    expect(Array.isArray(body.members)).toBe(true)
    expect(body.members.some((m: { id: string }) => m.id === users.member.id)).toBe(true)
  })

  it('Lưu trữ ban không có thành viên hoạt động thành công', async () => {
    // deptActive2 không có thành viên
    const res = await patchReq('board', `/admin/organization/departments/${deptActive2}`, {
      status: 'ARCHIVED',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ARCHIVED')
  })
})

describe('T4 - API GET /public/home & QĐ-4, BR-11', () => {
  let post1Id: string
  let post2Id: string
  let event1Id: string
  let project1Id: string

  beforeAll(async () => {
    // Tạo 2 bài viết công khai
    const post1 = await db.post.create({
      data: {
        title: `Bài viết A ${tag}`,
        slug: `post-a-${tag}`,
        summary: 'Tóm tắt bài A',
        content: 'Nội dung bài A',
        category: 'Thông báo',
        status: 'PUBLISHED',
        scope: 'PUBLIC',
        authorId: users.board.id,
        publishedAt: new Date(Date.now() - 3600000),
      },
    })
    const post2 = await db.post.create({
      data: {
        title: `Bài viết B ${tag}`,
        slug: `post-b-${tag}`,
        summary: 'Tóm tắt bài B',
        content: 'Nội dung bài B',
        category: 'Tin tức',
        status: 'PUBLISHED',
        scope: 'PUBLIC',
        authorId: users.board.id,
        publishedAt: new Date(),
      },
    })
    post1Id = post1.id
    post2Id = post2.id
    postIds.push(post1.id, post2.id)

    // Tạo sự kiện sắp diễn ra
    const event1 = await db.event.create({
      data: {
        title: `Sự kiện Sắp tới ${tag}`,
        slug: `evt-upcoming-${tag}`,
        description: 'Mô tả sự kiện',
        eventType: 'Workshop',
        status: 'PUBLISHED',
        audience: 'PUBLIC',
        startAt: new Date(Date.now() + 86400000),
        endAt: new Date(Date.now() + 90000000),
        createdById: users.board.id,
      },
    })
    event1Id = event1.id
    eventIds.push(event1.id)

    // Tạo dự án công khai
    const project1 = await db.project.create({
      data: {
        title: `Dự án A ${tag}`,
        slug: `project-a-${tag}`,
        description: 'Mô tả dự án',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        createdById: users.board.id,
      },
    })
    project1Id = project1.id
    projectIds.push(project1.id)
  })

  it('Chưa chọn nội dung nổi bật: trang chủ hiện các mục mới nhất đang công khai (QĐ-4)', async () => {
    // Xóa cấu hình featured trong siteSetting
    const current = await db.siteSetting.findUnique({ where: { id: 'singleton' } })
    const info = (current?.info as Record<string, unknown>) ?? {}
    delete info.featured
    await db.siteSetting.update({ where: { id: 'singleton' }, data: { info: info as any } })

    const res = await app.inject({ method: 'GET', url: '/public/home' })
    expect(res.statusCode).toBe(200)
    const data = res.json()
    expect(data.news.length).toBeGreaterThanOrEqual(1)
    expect(data.events.length).toBeGreaterThanOrEqual(1)
    expect(data.projects.length).toBeGreaterThanOrEqual(1)
  })

  it('Chọn một bài nổi bật thì bài đó hiện trên trang chủ; gỡ bài đó thì quay về mục mới nhất (BR-11, QĐ-4)', async () => {
    // 1. Board chọn post1 làm nổi bật (dù post2 mới hơn)
    const selectRes = await put('board', '/admin/organization/featured-content', {
      postIds: [post1Id],
      eventIds: [event1Id],
      projectIds: [project1Id],
    })
    expect(selectRes.statusCode).toBe(200)

    // Trang chủ phải trả post1 ở vị trí đầu tiên
    const homeRes1 = await app.inject({ method: 'GET', url: '/public/home' })
    expect(homeRes1.statusCode).toBe(200)
    const data1 = homeRes1.json()
    expect(data1.news[0].id).toBe(post1Id)

    // 2. Chuyển post1 sang DRAFT (bị gỡ khỏi công khai)
    await db.post.update({ where: { id: post1Id }, data: { status: 'DRAFT' } })

    // Trang chủ tự động bỏ qua post1 và quay về mục mới nhất đang công khai (post2)
    const homeRes2 = await app.inject({ method: 'GET', url: '/public/home' })
    expect(homeRes2.statusCode).toBe(200)
    const data2 = homeRes2.json()
    expect(data2.news[0].id).toBe(post2Id)
  })

  it('Từ chối chọn nội dung không công khai vào featured-content (409 Conflict)', async () => {
    // Đảm bảo post1 đang ở trạng thái DRAFT
    await db.post.update({ where: { id: post1Id }, data: { status: 'DRAFT' } })

    const res = await put('board', '/admin/organization/featured-content', {
      postIds: [post1Id],
      eventIds: [],
      projectIds: [],
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().message).toContain('Chỉ có thể chọn bài viết đang công khai')
  })
})

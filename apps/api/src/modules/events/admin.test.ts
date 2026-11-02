import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { AuthUser } from '../auth/rbac.js'

// Test tích hợp với Postgres thật (như events.test.ts), người dùng giả qua header x-test-user
// (như files.test.ts). Mọi request POST/PATCH gửi Origin đúng WEB_URL để qua kiểm tra CSRF.
const config = loadConfig({ NODE_ENV: 'test' })
const ORIGIN = 'http://localhost:5173'
const tag = randomUUID().slice(0, 8)
const HOUR_MS = 3_600_000

type UserKey = 'manager' | 'managerB' | 'managerBoth' | 'board' | 'member'
const users = {} as Record<UserKey, AuthUser>
const userIds: string[] = []
const departmentIds: string[] = []
const eventIds: string[] = []

let app: ReturnType<typeof buildApp>
let deptA = ''
let deptB = ''
let deptArchived = ''

const inHours = (hours: number) => new Date(Date.now() + hours * HOUR_MS)

async function get(user: UserKey | null, url: string) {
  return app.inject({ method: 'GET', url, headers: user ? { 'x-test-user': user } : {} })
}
async function post(user: UserKey | null, url: string, payload?: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url,
    ...(payload && { payload }), // exactOptionalPropertyTypes: không gửi khóa khi không có payload
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

/** Dữ liệu gửi lên POST /admin/events, hợp lệ mặc định (startAt +48h, endAt +50h). */
function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: `Sự kiện mới ${randomUUID().slice(0, 6)}`,
    description: 'Mô tả sự kiện quản trị.',
    eventType: 'Workshop',
    audience: 'DEPARTMENT',
    startAt: inHours(48).toISOString(),
    endAt: inHours(50).toISOString(),
    ...overrides,
  }
}

/** Tạo sự kiện trực tiếp trong DB cho các tình huống có sẵn trạng thái/phạm vi. */
async function createEventFixture(opts: {
  departmentId?: string | null
  status?: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'ENDED'
  audience?: 'PUBLIC' | 'CLUB' | 'DEPARTMENT'
  capacity?: number | null
  createdBy?: string
}) {
  const suffix = randomUUID().slice(0, 6)
  const startAt = inHours(48)
  const event = await db.event.create({
    data: {
      title: `Sự kiện E4 ${suffix}`,
      slug: `evt-e4-${suffix}-${tag}`,
      description: 'Mô tả sự kiện test.',
      eventType: 'Workshop',
      status: opts.status ?? 'PUBLISHED',
      audience: opts.audience ?? 'DEPARTMENT',
      departmentId: opts.departmentId ?? null,
      createdById: opts.createdBy ?? userIds[0]!,
      startAt,
      endAt: new Date(startAt.getTime() + 2 * HOUR_MS),
      capacity: opts.capacity ?? null,
    },
  })
  eventIds.push(event.id)
  return event
}

async function createGuestRegistration(eventId: string, email: string) {
  await db.eventRegistration.create({
    data: { eventId, guestFullName: 'Khách test', guestEmail: email, registrationCode: randomUUID().slice(0, 12).toUpperCase() },
  })
}

beforeAll(async () => {
  app = buildApp(config)
  app.addHook('onRequest', async (request) => {
    const key = request.headers['x-test-user'] as UserKey | undefined
    request.user = key && users[key] ? users[key] : null
  })
  await app.ready()

  const [a, b, archived] = await Promise.all([
    db.department.create({ data: { name: `Ban A ${tag}`, code: `evt4-a-${tag}` } }),
    db.department.create({ data: { name: `Ban B ${tag}`, code: `evt4-b-${tag}` } }),
    db.department.create({ data: { name: `Ban C ${tag}`, code: `evt4-c-${tag}`, status: 'ARCHIVED' } }),
  ])
  deptA = a.id
  deptB = b.id
  deptArchived = archived.id
  departmentIds.push(deptA, deptB, deptArchived)

  const mkUser = async (key: string, departmentId: string | null, fullName: string) => {
    const user = await db.user.create({
      data: {
        username: `evt4-${key}-${tag}`,
        email: `evt4-${key}-${tag}@test.local`,
        passwordHash: 'khong-dung',
        fullName,
        departmentId,
        mustChangePassword: false,
      },
    })
    userIds.push(user.id)
    return user
  }

  const managerA = await mkUser('manager', deptA, 'Quản lý Ban A')
  const managerB = await mkUser('managerB', deptB, 'Quản lý Ban B')
  const managerBoth = await mkUser('managerBoth', deptA, 'Quản lý hai ban')
  const board = await mkUser('board', null, 'Thành viên Ban Chủ nhiệm')
  const member = await mkUser('member', deptA, 'Thành viên thường')

  // roles luôn có dòng MEMBER nền (RP-01); ROLE bảng user_roles không cần tạo vì rbac đọc request.user.
  const base = (departmentId: string | null) => ({ role: 'MEMBER' as const, departmentId })
  users.manager = { id: managerA.id, departmentId: deptA, roles: [base(deptA), { role: 'DEPARTMENT_MANAGER', departmentId: deptA }] }
  users.managerB = { id: managerB.id, departmentId: deptB, roles: [base(deptB), { role: 'DEPARTMENT_MANAGER', departmentId: deptB }] }
  users.managerBoth = {
    id: managerBoth.id,
    departmentId: deptA,
    roles: [base(deptA), { role: 'DEPARTMENT_MANAGER', departmentId: deptA }, { role: 'DEPARTMENT_MANAGER', departmentId: deptB }],
  }
  users.board = { id: board.id, departmentId: null, roles: [base(null), { role: 'BOARD', departmentId: null }] }
  users.member = { id: member.id, departmentId: deptA, roles: [base(deptA)] }
})

afterAll(async () => {
  await app.close()
  await db.notificationDelivery.deleteMany({ where: { refType: 'EVENT', refId: { in: eventIds } } })
  // 401/403 bị chặn cũng ghi audit (targetType ROUTE, actorId là người gọi) — xóa theo actorId luôn.
  await db.auditLog.deleteMany({
    where: { OR: [{ targetType: 'EVENT', targetId: { in: eventIds } }, { actorId: { in: userIds } }] },
  })
  await db.eventRegistration.deleteMany({ where: { eventId: { in: eventIds } } })
  await db.event.deleteMany({ where: { id: { in: eventIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await db.department.deleteMany({ where: { id: { in: departmentIds } } })
})

// ─── GET /admin/events ──────────────────────────────────────────────────────

describe('GET /admin/events', () => {
  it('board thấy mọi sự kiện, kể cả DRAFT và ARCHIVED', async () => {
    const draft = await createEventFixture({ departmentId: deptA, status: 'DRAFT' })
    const archived = await createEventFixture({ departmentId: deptA, status: 'PUBLISHED' })
    await db.event.update({ where: { id: archived.id }, data: { status: 'ARCHIVED' } })
    const otherDept = await createEventFixture({ departmentId: deptB })

    // Lọc theo ban của test này để kết quả tất định: các file test chạy song song tạo thêm sự kiện
    // (kể cả departmentId null) nên KHÔNG khẳng định gì về items[0] của danh sách không lọc.
    const response = await get('board', `/admin/events?departmentId=${deptA}&pageSize=100`)
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body).toEqual(expect.objectContaining({ page: 1, pageSize: 100 }))
    const items = body.items as { id: string; status: string; registeredCount: number; department: { id: string } | null }[]
    const byId = new Map(items.map((item) => [item.id, item]))
    expect(byId.get(draft.id)?.status).toBe('DRAFT')
    expect(byId.get(archived.id)?.status).toBe('ARCHIVED')
    for (const item of items) {
      // Mọi dòng trả ra đều đủ số đăng ký và thông tin ban quản lý.
      expect(item.registeredCount).toEqual(expect.any(Number))
      expect(item.department).toEqual(expect.objectContaining({ id: deptA }))
    }

    // Không lọc ban: BOARD vẫn thấy được sự kiện của ban khác trong danh sách.
    const unfilteredIds = ((await get('board', '/admin/events?pageSize=100')).json().items as { id: string }[]).map((item) => item.id)
    expect(unfilteredIds).toContain(otherDept.id)
  })

  it('manager lọc ?departmentId= sang ban khác nhận danh sách rỗng, không lộ dữ liệu', async () => {
    const theirs = await createEventFixture({ departmentId: deptB })
    const mine = await createEventFixture({ departmentId: deptA, status: 'DRAFT' })

    // Lọc ban khác phải gộp AND với phạm vi ban mình: AND(ban A theo phạm vi, ban B theo lọc) → rỗng,
    // tuyệt đối không trả dữ liệu Ban B (docs/02 §12 — không cho biết dữ liệu có tồn tại hay không).
    const response = await get('manager', `/admin/events?departmentId=${deptB}&pageSize=100`)
    expect(response.statusCode).toBe(200)
    expect(response.json().items).toHaveLength(0)

    // Lọc đúng ban mình vẫn hoạt động bình thường.
    const ownIds = ((await get('manager', `/admin/events?departmentId=${deptA}&pageSize=100`)).json().items as { id: string }[]).map(
      (item) => item.id,
    )
    expect(ownIds).toContain(mine.id)
    expect(ownIds).not.toContain(theirs.id)
  })

  it('manager chỉ thấy sự kiện các ban mình quản lý, lọc status hoạt động', async () => {
    const mine = await createEventFixture({ departmentId: deptA, status: 'DRAFT' })
    await createEventFixture({ departmentId: deptB })

    const response = await get('manager', '/admin/events?status=DRAFT&pageSize=100')
    expect(response.statusCode).toBe(200)
    const body = response.json()
    const ids: string[] = body.items.map((item: { id: string }) => item.id)
    expect(ids).toContain(mine.id)
    for (const item of body.items as { departmentId: string; status: string }[]) {
      expect(item.departmentId).toBe(deptA)
      expect(item.status).toBe('DRAFT')
    }
  })

  it('chưa đăng nhập trả 401, thành viên thường trả 403', async () => {
    expect((await get(null, '/admin/events')).statusCode).toBe(401)
    expect((await get('member', '/admin/events')).statusCode).toBe(403)
  })
})

// ─── POST /admin/events ─────────────────────────────────────────────────────

describe('POST /admin/events', () => {
  it('manager tạo sự kiện: 201, DRAFT, ban quản lý tự gán là ban mình', async () => {
    const payload = validPayload({ title: 'Workshop Git nội bộ Ban A' })
    const response = await post('manager', '/admin/events', payload)
    expect(response.statusCode).toBe(201)
    const body = response.json()
    eventIds.push(body.id)
    expect(body).toEqual(
      expect.objectContaining({ status: 'DRAFT', departmentId: deptA, audience: 'DEPARTMENT', registeredCount: 0 }),
    )
    expect(body.slug).toMatch(/^workshop-git-noi-bo-ban-a/)

    const stored = await db.event.findUniqueOrThrow({ where: { id: body.id } })
    expect(stored.createdById).toBe(users.manager.id)
  })

  it('board tạo được sự kiện cho ban khác đang hoạt động, và không chọn ban thì departmentId null', async () => {
    const forDeptB = await post('board', '/admin/events', validPayload({ departmentId: deptB }))
    expect(forDeptB.statusCode).toBe(201)
    expect(forDeptB.json().departmentId).toBe(deptB)
    eventIds.push(forDeptB.json().id)

    const withoutDept = await post('board', '/admin/events', validPayload())
    expect(withoutDept.statusCode).toBe(201)
    expect(withoutDept.json().departmentId).toBeNull()
    eventIds.push(withoutDept.json().id)
  })

  it('manager tự chọn ban khác bị từ chối 403', async () => {
    const response = await post('manager', '/admin/events', validPayload({ departmentId: deptB }))
    expect(response.statusCode).toBe(403)
    expect(response.json().error).toBe('forbidden')
  })

  it('endAt không sau startAt trả 422 kèm issues chỉ vào endAt', async () => {
    const response = await post('manager', '/admin/events', validPayload({ endAt: inHours(47).toISOString() }))
    expect(response.statusCode).toBe(422)
    const body = response.json()
    expect(body.error).toBe('validation')
    expect(body.issues[0].path).toEqual(['endAt'])
  })

  it('registrationClosesAt sau endAt trả 422', async () => {
    const response = await post('manager', '/admin/events', validPayload({ registrationClosesAt: inHours(60).toISOString() }))
    expect(response.statusCode).toBe(422)
    expect(response.json().issues[0].path).toEqual(['registrationClosesAt'])
  })

  it('audience CLUB mà cho khách đăng ký trả 422', async () => {
    const response = await post('manager', '/admin/events', validPayload({ audience: 'CLUB', allowGuestRegistration: true }))
    expect(response.statusCode).toBe(422)
    expect(response.json().issues[0].path).toEqual(['allowGuestRegistration'])
  })

  it('board tạo cho ban đã lưu trữ trả 422 (ORG-06)', async () => {
    const response = await post('board', '/admin/events', validPayload({ departmentId: deptArchived }))
    expect(response.statusCode).toBe(422)
    expect(response.json().message).toContain('lưu trữ')
  })

  it('manager quản lý hai ban mà không chọn ban trả 422', async () => {
    const response = await post('managerBoth', '/admin/events', validPayload())
    expect(response.statusCode).toBe(422)
    expect(response.json().message).toContain('nhiều ban')
  })

  it('thành viên thường trả 403, khách chưa đăng nhập trả 401', async () => {
    expect((await post('member', '/admin/events', validPayload())).statusCode).toBe(403)
    expect((await post(null, '/admin/events', validPayload())).statusCode).toBe(401)
  })
})

// ─── GET /admin/events/:id ──────────────────────────────────────────────────

describe('GET /admin/events/:id', () => {
  it('manager xem chi tiết sự kiện ban mình, có registeredCount', async () => {
    const event = await createEventFixture({ departmentId: deptA })
    await createGuestRegistration(event.id, `khach-${randomUUID().slice(0, 6)}@test.local`)

    const response = await get('manager', `/admin/events/${event.id}`)
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(expect.objectContaining({ id: event.id, registeredCount: 1, status: 'PUBLISHED' }))
  })

  it('manager mở sự kiện Ban B nhận 404, board vẫn xem được', async () => {
    const other = await createEventFixture({ departmentId: deptB })
    expect((await get('manager', `/admin/events/${other.id}`)).statusCode).toBe(404)
    expect((await get('board', `/admin/events/${other.id}`)).statusCode).toBe(200)
  })
})

// ─── PATCH /admin/events/:id ────────────────────────────────────────────────

describe('PATCH /admin/events/:id', () => {
  it('sửa tiêu đề sự kiện đang công bố: 200 và dữ liệu cập nhật', async () => {
    const event = await createEventFixture({ departmentId: deptA })
    const response = await patchReq('manager', `/admin/events/${event.id}`, { title: 'Tiêu đề mới E4' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(expect.objectContaining({ id: event.id, title: 'Tiêu đề mới E4' }))
    expect(response.json().slug).toBe(event.slug) // slug không đổi khi sửa
  })

  it('sức chứa nhỏ hơn số đã đăng ký trả 422', async () => {
    const event = await createEventFixture({ departmentId: deptA, capacity: 5 })
    await createGuestRegistration(event.id, `khach-a-${randomUUID().slice(0, 6)}@test.local`)
    await createGuestRegistration(event.id, `khach-b-${randomUUID().slice(0, 6)}@test.local`)

    const response = await patchReq('board', `/admin/events/${event.id}`, { capacity: 1 })
    expect(response.statusCode).toBe(422)
    expect(response.json().message).toContain('đã đăng ký')
  })

  it('PATCH riêng startAt vẫn phải trước endAt đang có (kiểm trên dữ liệu gộp)', async () => {
    const event = await createEventFixture({ departmentId: deptA })
    const response = await patchReq('manager', `/admin/events/${event.id}`, { startAt: inHours(72).toISOString() })
    expect(response.statusCode).toBe(422)
    expect(response.json().issues[0].path).toEqual(['endAt'])
  })

  it('sự kiện đã hủy trả 409', async () => {
    const event = await createEventFixture({ departmentId: deptA, status: 'CANCELLED' })
    const response = await patchReq('board', `/admin/events/${event.id}`, { title: 'Sửa sau khi hủy' })
    expect(response.statusCode).toBe(409)
  })

  it('manager sửa sự kiện Ban B nhận 404', async () => {
    const other = await createEventFixture({ departmentId: deptB })
    expect((await patchReq('manager', `/admin/events/${other.id}`, { title: 'X' })).statusCode).toBe(404)
  })

  it('leo thang quyền: công bố sự kiện nội bộ xong PATCH audience thành PUBLIC nhận 403, có audit FAILURE', async () => {
    // Kịch bản tấn công: manager công bố sự kiện DEPARTMENT (được phép), rồi PATCH đổi đối tượng
    // thành PUBLIC để công khai mà không qua BOARD (docs/02 §8.3).
    const event = await createEventFixture({ departmentId: deptA, status: 'DRAFT', audience: 'DEPARTMENT' })
    expect((await post('manager', `/admin/events/${event.id}/publish`)).statusCode).toBe(200)

    const response = await patchReq('manager', `/admin/events/${event.id}`, { audience: 'PUBLIC' })
    expect(response.statusCode).toBe(403)
    expect(response.json().error).toBe('forbidden')

    // Dữ liệu không đổi: vẫn nội bộ, vẫn đang công bố.
    const stored = await db.event.findUniqueOrThrow({ where: { id: event.id } })
    expect(stored).toEqual(expect.objectContaining({ audience: 'DEPARTMENT', status: 'PUBLISHED' }))

    // Vụ bị chặn phải có dấu vết audit FAILURE (ngay cả khi không có dòng nào được sửa).
    const audits = await db.auditLog.findMany({
      where: { targetType: 'EVENT', targetId: event.id, action: 'event.publish', result: 'FAILURE' },
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]?.reason).toContain('PUBLIC')
  })

  it('manager PATCH audience thành CLUB cũng nhận 403; sửa nội dung khác vẫn bình thường', async () => {
    const event = await createEventFixture({ departmentId: deptA, status: 'PUBLISHED', audience: 'DEPARTMENT' })
    expect((await patchReq('manager', `/admin/events/${event.id}`, { audience: 'CLUB' })).statusCode).toBe(403)

    // PATCH không đụng audience thì không bị chặn: công bố CLUB/PUBLIC chỉ chặn ở bước publish (§8.3).
    const ok = await patchReq('manager', `/admin/events/${event.id}`, { title: 'Tiêu đề vẫn nội bộ' })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toEqual(expect.objectContaining({ title: 'Tiêu đề vẫn nội bộ', audience: 'DEPARTMENT' }))
  })
})

// ─── POST /admin/events/:id/publish ─────────────────────────────────────────

describe('POST /admin/events/:id/publish', () => {
  it('manager công bố sự kiện nội bộ ban mình: 200 PUBLISHED', async () => {
    const event = await createEventFixture({ departmentId: deptA, status: 'DRAFT', audience: 'DEPARTMENT' })
    const response = await post('manager', `/admin/events/${event.id}/publish`)
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(expect.objectContaining({ id: event.id, status: 'PUBLISHED' }))
  })

  it('manager công bố sự kiện PUBLIC hoặc CLUB nhận 403', async () => {
    const publicEvent = await createEventFixture({ departmentId: deptA, status: 'DRAFT', audience: 'PUBLIC' })
    const clubEvent = await createEventFixture({ departmentId: deptA, status: 'DRAFT', audience: 'CLUB' })
    expect((await post('manager', `/admin/events/${publicEvent.id}/publish`)).statusCode).toBe(403)
    expect((await post('manager', `/admin/events/${clubEvent.id}/publish`)).statusCode).toBe(403)
  })

  it('board công bố sự kiện PUBLIC: 200', async () => {
    const event = await createEventFixture({ departmentId: deptA, status: 'DRAFT', audience: 'PUBLIC' })
    const response = await post('board', `/admin/events/${event.id}/publish`)
    expect(response.statusCode).toBe(200)
    expect(response.json().status).toBe('PUBLISHED')
  })

  it('công bố khi không còn DRAFT trả 409', async () => {
    const event = await createEventFixture({ departmentId: deptA, status: 'PUBLISHED' })
    const response = await post('manager', `/admin/events/${event.id}/publish`)
    expect(response.statusCode).toBe(409)
    // Bị chặn cũng phải có dấu vết audit FAILURE.
    const audits = await db.auditLog.findMany({ where: { targetType: 'EVENT', targetId: event.id, action: 'event.publish' } })
    expect(audits.some((row) => row.result === 'FAILURE')).toBe(true)
  })
})

// ─── POST /admin/events/:id/cancel ──────────────────────────────────────────

describe('POST /admin/events/:id/cancel', () => {
  it('hủy có lý do: cancelReason lưu, đăng ký giữ nguyên, email + audit SUCCESS', async () => {
    const event = await createEventFixture({ departmentId: deptA })
    const guestEmail = `khach-huy-${randomUUID().slice(0, 6)}@test.local`
    await createGuestRegistration(event.id, guestEmail)
    await db.eventRegistration.create({
      data: {
        eventId: event.id,
        userId: users.member.id,
        registrationCode: randomUUID().slice(0, 12).toUpperCase(),
      },
    })

    const response = await post('manager', `/admin/events/${event.id}/cancel`, { reason: 'Thiếu người tham dự' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(expect.objectContaining({ status: 'CANCELLED', cancelReason: 'Thiếu người tham dự', registeredCount: 2 }))

    // EVT-09: dữ liệu đăng ký vẫn còn REGISTERED.
    const registrations = await db.eventRegistration.findMany({ where: { eventId: event.id } })
    expect(registrations).toHaveLength(2)
    expect(registrations.every((row) => row.status === 'REGISTERED')).toBe(true)

    // NTF-01: một thư cho khách, một thư cho thành viên (email lấy từ User).
    const deliveries = await db.notificationDelivery.findMany({ where: { refType: 'EVENT', refId: event.id, type: 'EVENT_CANCELLED' } })
    expect(deliveries.map((row) => row.recipient).sort()).toEqual([guestEmail, `evt4-member-${tag}@test.local`].sort())
    expect(deliveries.every((row) => row.status === 'PENDING')).toBe(true)

    const audits = await db.auditLog.findMany({ where: { targetType: 'EVENT', targetId: event.id, action: 'event.cancel' } })
    expect(audits.filter((row) => row.result === 'SUCCESS')).toHaveLength(1)
  })

  it('hủy không có lý do trả 422', async () => {
    const event = await createEventFixture({ departmentId: deptA })
    const response = await post('manager', `/admin/events/${event.id}/cancel`, {})
    expect(response.statusCode).toBe(422)
  })

  it('DRAFT → CANCELLED bị chặn 409', async () => {
    const event = await createEventFixture({ departmentId: deptA, status: 'DRAFT' })
    const response = await post('manager', `/admin/events/${event.id}/cancel`, { reason: 'Hủy nháp' })
    expect(response.statusCode).toBe(409)
    const stored = await db.event.findUniqueOrThrow({ where: { id: event.id } })
    expect(stored.status).toBe('DRAFT')
  })

  it('hủy hai lần trả 409', async () => {
    const event = await createEventFixture({ departmentId: deptA, status: 'CANCELLED' })
    const response = await post('manager', `/admin/events/${event.id}/cancel`, { reason: 'Hủy lần nữa' })
    expect(response.statusCode).toBe(409)
  })

  it('manager hủy sự kiện Ban B nhận 404', async () => {
    const other = await createEventFixture({ departmentId: deptB })
    expect((await post('manager', `/admin/events/${other.id}/cancel`, { reason: 'X' })).statusCode).toBe(404)
  })
})

// ─── POST /admin/events/:id/archive ─────────────────────────────────────────

describe('POST /admin/events/:id/archive', () => {
  it('lưu trữ từ ENDED và từ CANCELLED: 200 ARCHIVED', async () => {
    const ended = await createEventFixture({ departmentId: deptA, status: 'ENDED' })
    const endedResponse = await post('manager', `/admin/events/${ended.id}/archive`)
    expect(endedResponse.statusCode).toBe(200)
    expect(endedResponse.json().status).toBe('ARCHIVED')

    const cancelled = await createEventFixture({ departmentId: deptA, status: 'CANCELLED' })
    expect((await post('manager', `/admin/events/${cancelled.id}/archive`)).json().status).toBe('ARCHIVED')
  })

  it('PUBLISHED → ARCHIVED bị chặn 409 (lưu trữ chỉ từ CANCELLED/ENDED)', async () => {
    const event = await createEventFixture({ departmentId: deptA, status: 'PUBLISHED' })
    const response = await post('manager', `/admin/events/${event.id}/archive`)
    expect(response.statusCode).toBe(409)
  })

  it('DRAFT → ARCHIVED và lưu trữ ARCHIVED lần nữa đều 409', async () => {
    const draft = await createEventFixture({ departmentId: deptA, status: 'DRAFT' })
    expect((await post('manager', `/admin/events/${draft.id}/archive`)).statusCode).toBe(409)

    const archivedEvent = await createEventFixture({ departmentId: deptA, status: 'ENDED' })
    await post('manager', `/admin/events/${archivedEvent.id}/archive`)
    expect((await post('manager', `/admin/events/${archivedEvent.id}/archive`)).statusCode).toBe(409)
  })
})

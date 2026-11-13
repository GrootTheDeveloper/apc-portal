import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { publicCode } from '../../lib/ids.js'
import type { AuthUser } from '../auth/rbac.js'

/**
 * Test tích hợp portal thành viên (E5) với Postgres thật. Người dùng giả qua header x-test-user
 * (như admin.test.ts); mọi request POST gửi Origin đúng WEB_URL để qua kiểm tra CSRF.
 * Phạm vi xem theo docs/plan E5: PUBLIC, CLUB với mọi thành viên; DEPARTMENT chỉ người thuộc ban quản lý.
 */
const config = loadConfig({ NODE_ENV: 'test' })
const ORIGIN = 'http://localhost:5173'
const tag = randomUUID().slice(0, 8)
const HOUR_MS = 3_600_000

type UserKey = 'memberA' | 'memberB' | 'memberNoDept' | 'board'
const users = {} as Record<UserKey, AuthUser>
const userIds: string[] = []
const departmentIds: string[] = []
const eventIds: string[] = []
const createdRegistrationIds: string[] = []

let app: ReturnType<typeof buildApp>
let deptA = ''
let deptB = ''

const inHours = (hours: number) => new Date(Date.now() + hours * HOUR_MS)

async function get(user: UserKey | null, url: string) {
  return app.inject({ method: 'GET', url, headers: user ? { 'x-test-user': user } : {} })
}
async function post(user: UserKey | null, url: string) {
  return app.inject({ method: 'POST', url, headers: { origin: ORIGIN, ...(user ? { 'x-test-user': user } : {}) } })
}
const postRegister = (user: UserKey | null, eventId: string) => post(user, `/portal/events/${eventId}/registrations`)
const postCancel = (user: UserKey | null, eventId: string) => post(user, `/portal/events/${eventId}/registrations/cancel`)

/** Tạo sự kiện trực tiếp trong DB; mặc định PUBLISHED, bắt đầu sau 48h. */
async function createEventFixture(opts: {
  suffix?: string
  status?: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'ENDED' | 'ARCHIVED'
  audience?: 'PUBLIC' | 'CLUB' | 'DEPARTMENT'
  departmentId?: string | null
  capacity?: number | null
  allowGuestRegistration?: boolean
  registrationOpensAt?: Date | null
  registrationClosesAt?: Date | null
  startInHours?: number
  durationHours?: number
}) {
  const suffix = opts.suffix ?? randomUUID().slice(0, 6)
  const startAt = inHours(opts.startInHours ?? 48)
  const event = await db.event.create({
    data: {
      title: `Sự kiện E5 ${suffix}`,
      slug: `evt-e5-${suffix}-${tag}`,
      description: 'Mô tả sự kiện test.',
      eventType: 'Workshop',
      status: opts.status ?? 'PUBLISHED',
      audience: opts.audience ?? 'PUBLIC',
      departmentId: opts.departmentId ?? null,
      createdById: userIds[0]!,
      startAt,
      endAt: new Date(startAt.getTime() + (opts.durationHours ?? 2) * HOUR_MS),
      capacity: opts.capacity ?? null,
      allowGuestRegistration: opts.allowGuestRegistration ?? false,
      registrationOpensAt: opts.registrationOpensAt ?? null,
      registrationClosesAt: opts.registrationClosesAt ?? null,
    },
  })
  eventIds.push(event.id)
  return event
}

/** Đăng ký thành viên trực tiếp trong DB (dùng cho tình huống cửa sổ đã đóng, không đăng ký qua API được). */
async function createMemberRegistration(eventId: string, userId: string) {
  const registration = await db.eventRegistration.create({
    data: { eventId, userId, registrationCode: publicCode() },
  })
  createdRegistrationIds.push(registration.id)
  return registration
}

beforeAll(async () => {
  app = buildApp(config)
  app.addHook('onRequest', async (request) => {
    const key = request.headers['x-test-user'] as UserKey | undefined
    request.user = key && users[key] ? users[key] : null
  })
  await app.ready()

  const [a, b] = await Promise.all([
    db.department.create({ data: { name: `Ban A ${tag}`, code: `evt5-a-${tag}` } }),
    db.department.create({ data: { name: `Ban B ${tag}`, code: `evt5-b-${tag}` } }),
  ])
  deptA = a.id
  deptB = b.id
  departmentIds.push(deptA, deptB)

  const mkUser = async (key: string, departmentId: string | null) => {
    const user = await db.user.create({
      data: {
        username: `evt5-${key}-${tag}`,
        email: `evt5-${key}-${tag}@test.local`,
        passwordHash: 'khong-dung',
        fullName: `Thành viên ${key}`,
        departmentId,
        mustChangePassword: false,
      },
    })
    userIds.push(user.id)
    return user
  }

  const [userA, userB, userNoDept, userBoard] = await Promise.all([
    mkUser('member-a', deptA),
    mkUser('member-b', deptB),
    mkUser('member-nodept', null),
    mkUser('board', null),
  ])

  // roles luôn có dòng MEMBER nền (RP-01); rbac đọc request.user nên không cần dòng user_roles
  const base = (departmentId: string | null) => ({ role: 'MEMBER' as const, departmentId })
  users.memberA = { id: userA.id, departmentId: deptA, roles: [base(deptA)] }
  users.memberB = { id: userB.id, departmentId: deptB, roles: [base(deptB)] }
  users.memberNoDept = { id: userNoDept.id, departmentId: null, roles: [base(null)] }
  users.board = { id: userBoard.id, departmentId: null, roles: [base(null)] }
})

afterAll(async () => {
  // Email nối với đăng ký theo refId (không có FK, tự dọn để không còn dòng mồ côi)
  const registrationIds = (
    await db.eventRegistration.findMany({ where: { eventId: { in: eventIds } }, select: { id: true } })
  ).map((registration) => registration.id)
  await db.notificationDelivery.deleteMany({ where: { refType: 'EVENT_REGISTRATION', refId: { in: [...registrationIds, ...createdRegistrationIds] } } })
  await db.eventRegistration.deleteMany({ where: { eventId: { in: eventIds } } })
  await db.event.deleteMany({ where: { id: { in: eventIds } } })
  await db.department.deleteMany({ where: { id: { in: departmentIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await app.close()
  await db.$disconnect()
})

// ─── GET /portal/events ───────────────────────────────────────────────────

describe('GET /portal/events', () => {
  it('trả PUBLIC + CLUB + sự kiện nội bộ ban mình, ẩn nội bộ ban khác, nháp và lưu trữ', async () => {
    const publicEvent = await createEventFixture({ suffix: 'pub', audience: 'PUBLIC' })
    const clubEvent = await createEventFixture({ suffix: 'club', audience: 'CLUB' })
    const ownDeptEvent = await createEventFixture({ suffix: 'dept-a', audience: 'DEPARTMENT', departmentId: deptA })
    const otherDeptEvent = await createEventFixture({ suffix: 'dept-b', audience: 'DEPARTMENT', departmentId: deptB })
    await createEventFixture({ suffix: 'draft', audience: 'DEPARTMENT', departmentId: deptA, status: 'DRAFT' })
    await createEventFixture({ suffix: 'archived', audience: 'CLUB', status: 'ARCHIVED' })

    const response = await get('memberA', '/portal/events')
    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body).toMatchObject({ items: expect.any(Array), total: expect.any(Number), page: 1 })
    const slugs: string[] = body.items.map((item: { slug: string }) => item.slug)
    for (const slug of [publicEvent.slug, clubEvent.slug, ownDeptEvent.slug]) expect(slugs).toContain(slug)
    for (const slug of [otherDeptEvent.slug, `evt-e5-draft-${tag}`, `evt-e5-archived-${tag}`]) {
      expect(slugs).not.toContain(slug)
    }

    // Item có id và trạng thái đăng ký của chính người xem; không lộ trường quản trị
    const item = body.items.find((item: { slug: string }) => item.slug === ownDeptEvent.slug)
    expect(item).toMatchObject({
      id: ownDeptEvent.id,
      audience: 'DEPARTMENT',
      departmentName: `Ban A ${tag}`,
      myRegistrationStatus: null,
    })
    for (const field of ['createdById', 'departmentId', 'description', 'contactPoint']) {
      expect(item).not.toHaveProperty(field)
    }
  })

  it('sự kiện nội bộ Ban B chỉ hiện với thành viên Ban B; thành viên không thuộc ban nào không thấy nội bộ nào', async () => {
    const deptBEvent = await createEventFixture({ suffix: 'only-b', audience: 'DEPARTMENT', departmentId: deptB })

    const asMemberB = await get('memberB', '/portal/events')
    expect((asMemberB.json().items as { id: string }[]).map((item) => item.id)).toContain(deptBEvent.id)

    const asMemberA = await get('memberA', '/portal/events')
    expect((asMemberA.json().items as { id: string }[]).map((item) => item.id)).not.toContain(deptBEvent.id)

    const asNoDept = await get('memberNoDept', '/portal/events')
    expect((asNoDept.json().items as { id: string }[]).map((item) => item.id)).not.toContain(deptBEvent.id)
  })

  it('chế độ lịch tháng (?month=) trả sự kiện bắt đầu trong tháng theo ngày Việt Nam', async () => {
    await createEventFixture({ suffix: 'in-month', startInHours: 6 })

    // Tháng hiện tại theo ngày Việt Nam = UTC + 7h (BR-14)
    const vn = new Date(Date.now() + 7 * HOUR_MS)
    const month = `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}`

    const response = await get('memberA', `/portal/events?month=${month}`)
    expect(response.statusCode).toBe(200)
    expect(response.json().items.length).toBeGreaterThanOrEqual(1)
  })

  it('chưa đăng nhập trả 401', async () => {
    const response = await get(null, '/portal/events')
    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBe('unauthenticated')
  })
})

// ─── GET /portal/events/:id ───────────────────────────────────────────────

describe('GET /portal/events/:id', () => {
  it('trả chi tiết đầy đủ cho thành viên thuộc ban quản lý, kèm registeredCount và myRegistration', async () => {
    const event = await createEventFixture({
      suffix: 'detail-ok',
      audience: 'DEPARTMENT',
      departmentId: deptA,
      capacity: 30,
    })

    const response = await get('memberA', `/portal/events/${event.id}`)
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body).toMatchObject({
      id: event.id,
      slug: event.slug,
      title: event.title,
      audience: 'DEPARTMENT',
      departmentName: `Ban A ${tag}`,
      capacity: 30,
      registeredCount: 0,
      myRegistration: null,
    })
    expect(body).toHaveProperty('description')
    expect(body).toHaveProperty('registrationClosesAt')
    // Trường quản trị không lộ qua API thành viên
    for (const field of ['createdById', 'departmentId', 'attendanceFinalizedAt']) {
      expect(body).not.toHaveProperty(field)
    }
  })

  it('thành viên ban khác mở thẳng sự kiện nội bộ nhận 404 (không tiết lộ sự kiện tồn tại)', async () => {
    const deptAEvent = await createEventFixture({ suffix: 'dept-a-only', audience: 'DEPARTMENT', departmentId: deptA })

    const response = await get('memberB', `/portal/events/${deptAEvent.id}`)
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })

  it('sự kiện CLUB hiện cho thành viên mọi ban; DRAFT, ARCHIVED và id lạ nhận 404', async () => {
    const clubEvent = await createEventFixture({ suffix: 'club-open', audience: 'CLUB' })
    expect((await get('memberB', `/portal/events/${clubEvent.id}`)).statusCode).toBe(200)

    const draft = await createEventFixture({ suffix: 'draft-x', audience: 'CLUB', status: 'DRAFT' })
    const archived = await createEventFixture({ suffix: 'archived-x', audience: 'CLUB', status: 'ARCHIVED' })
    expect((await get('memberA', `/portal/events/${draft.id}`)).statusCode).toBe(404)
    expect((await get('memberA', `/portal/events/${archived.id}`)).statusCode).toBe(404)
    expect((await get('memberA', `/portal/events/${randomUUID()}`)).statusCode).toBe(404)
  })

  it('chưa đăng nhập trả 401', async () => {
    const event = await createEventFixture({ suffix: 'detail-401' })
    const response = await get(null, `/portal/events/${event.id}`)
    expect(response.statusCode).toBe(401)
  })
})

// ─── POST /portal/events/:id/registrations ────────────────────────────────

describe('POST /portal/events/:id/registrations', () => {
  it('đăng ký thành công: gắn userId, xếp email xác nhận của thành viên trong cùng transaction (NTF-01)', async () => {
    const event = await createEventFixture({ suffix: 'reg-ok', audience: 'CLUB', capacity: 30 })

    const response = await postRegister('memberA', event.id)
    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body).toMatchObject({ status: 'REGISTERED', alreadyRegistered: false, cancelledAt: null })
    expect(body.registeredAt).toEqual(expect.any(String))

    const registration = await db.eventRegistration.findUniqueOrThrow({
      where: { eventId_userId: { eventId: event.id, userId: users.memberA.id } },
    })
    expect(registration).toMatchObject({ status: 'REGISTERED', attendanceStatus: 'NOT_MARKED' })
    expect(registration.userId).toBe(users.memberA.id)
    expect(registration.registrationCode).toMatch(/^[23456789A-Z]{12}$/)

    const delivery = await db.notificationDelivery.findFirst({
      where: { refType: 'EVENT_REGISTRATION', refId: registration.id },
    })
    expect(delivery).toMatchObject({
      type: 'EVENT_REGISTRATION_CONFIRMED_MEMBER',
      recipient: `evt5-member-a-${tag}@test.local`,
      status: 'PENDING',
    })
  })

  it('đăng ký lần hai hiện trạng thái đã đăng ký, không tạo bản ghi hay email mới (idempotent, FLOW-14)', async () => {
    const event = await createEventFixture({ suffix: 'reg-twice', audience: 'CLUB' })
    expect((await postRegister('memberA', event.id)).statusCode).toBe(201)

    const second = await postRegister('memberA', event.id)
    expect(second.statusCode).toBe(200)
    expect(second.json()).toMatchObject({ status: 'REGISTERED', alreadyRegistered: true })

    const rows = await db.eventRegistration.findMany({ where: { eventId: event.id, userId: users.memberA.id } })
    expect(rows).toHaveLength(1)
    const deliveries = await db.notificationDelivery.findMany({
      where: { refType: 'EVENT_REGISTRATION', refId: rows[0]!.id, type: 'EVENT_REGISTRATION_CONFIRMED_MEMBER' },
    })
    expect(deliveries).toHaveLength(1)
  })

  it('không áp dụng allowGuestRegistration cho thành viên: sự kiện công khai không nhận khách thì thành viên vẫn đăng ký được', async () => {
    const event = await createEventFixture({ suffix: 'reg-members-only', audience: 'PUBLIC', allowGuestRegistration: false })
    expect((await postRegister('memberA', event.id)).statusCode).toBe(201)
  })

  it('hủy rồi đăng ký lại kích hoạt dòng cũ: cùng id, trạng thái về REGISTERED, có email xác nhận mới', async () => {
    const event = await createEventFixture({ suffix: 'reg-reactivate', audience: 'CLUB' })
    expect((await postRegister('memberA', event.id)).statusCode).toBe(201)
    expect((await postCancel('memberA', event.id)).statusCode).toBe(200)

    const again = await postRegister('memberA', event.id)
    expect(again.statusCode).toBe(201)
    expect(again.json().alreadyRegistered).toBe(false)

    const row = await db.eventRegistration.findUniqueOrThrow({
      where: { eventId_userId: { eventId: event.id, userId: users.memberA.id } },
    })
    expect(row.status).toBe('REGISTERED')
    expect(row.cancelledAt).toBeNull()
    // Đăng ký + hủy + đăng ký lại = 2 email xác nhận, 1 email hủy
    const confirmations = await db.notificationDelivery.findMany({
      where: { refType: 'EVENT_REGISTRATION', refId: row.id, type: 'EVENT_REGISTRATION_CONFIRMED_MEMBER' },
    })
    expect(confirmations).toHaveLength(2)
    const cancellations = await db.notificationDelivery.findMany({
      where: { refType: 'EVENT_REGISTRATION', refId: row.id, type: 'EVENT_REGISTRATION_CANCELLED_MEMBER' },
    })
    expect(cancellations).toHaveLength(1)
  })

  it('sự kiện nội bộ ban khác → 404, không tiết lộ sự kiện có tồn tại (docs/02 mục 12)', async () => {
    const deptBEvent = await createEventFixture({ suffix: 'reg-foreign', audience: 'DEPARTMENT', departmentId: deptB })
    const response = await postRegister('memberA', deptBEvent.id)
    expect(response.statusCode).toBe(404)
    expect(await db.eventRegistration.count({ where: { eventId: deptBEvent.id } })).toBe(0)
  })

  it('sự kiện nội bộ ban khác ở trạng thái ENDED/CANCELLED cũng không hiện trong danh sách (nhóm đã kết thúc không mất bộ lọc phạm vi)', async () => {
    // Sự kiện ENDED rơi vào nhóm cuối của danh sách: điều kiện nhóm gộp bằng AND, không đè bộ lọc phạm vi
    const endedForeign = await createEventFixture({
      suffix: 'list-ended-foreign',
      audience: 'DEPARTMENT',
      departmentId: deptB,
      status: 'ENDED',
      startInHours: -3,
      durationHours: 1,
    })
    const cancelledForeign = await createEventFixture({
      suffix: 'list-cancelled-foreign',
      audience: 'DEPARTMENT',
      departmentId: deptB,
      status: 'CANCELLED',
    })

    const response = await get('memberA', '/portal/events')
    expect(response.statusCode).toBe(200)
    const ids: string[] = response.json().items.map((item: { id: string }) => item.id)
    expect(ids).not.toContain(endedForeign.id)
    expect(ids).not.toContain(cancelledForeign.id)
  })

  it('chặn đăng ký và nêu rõ lý do: chưa mở, hết hạn, đã hủy, đã kết thúc, đã diễn ra (BR-08)', async () => {
    const notOpen = await createEventFixture({
      suffix: 'reg-notopen',
      audience: 'CLUB',
      registrationOpensAt: inHours(24),
      registrationClosesAt: inHours(30),
    })
    const closed = await createEventFixture({ suffix: 'reg-closed', audience: 'CLUB', registrationClosesAt: inHours(-1) })
    const cancelled = await createEventFixture({ suffix: 'reg-cancelled-ev', audience: 'CLUB', status: 'CANCELLED' })
    const ended = await createEventFixture({ suffix: 'reg-ended-ev', audience: 'CLUB', status: 'ENDED' })
    // PUBLISHED đã qua thời điểm diễn ra mà registrationClosesAt để trống vẫn bị chặn (cùng phép kiểm với tác vụ event-end)
    const pastEnd = await createEventFixture({ suffix: 'reg-past-end', audience: 'CLUB', startInHours: -3, durationHours: 1 })

    expect((await postRegister('memberA', notOpen.id)).json().message).toContain('chưa mở đăng ký')
    expect((await postRegister('memberA', closed.id)).json().message).toContain('hết thời hạn đăng ký')
    expect((await postRegister('memberA', cancelled.id)).json().message).toContain('đã bị hủy')
    expect((await postRegister('memberA', ended.id)).json().message).toContain('đã kết thúc')
    expect((await postRegister('memberA', pastEnd.id)).json().message).toContain('đã diễn ra')

    for (const event of [notOpen, closed, cancelled, ended, pastEnd]) {
      expect(await db.eventRegistration.count({ where: { eventId: event.id } })).toBe(0)
    }
  })

  it('hết chỗ: lượt đầu chiếm chỗ, lượt sau nhận 409 vì hết chỗ; đăng ký lại sau khi hủy vẫn bị chặn khi hết chỗ', async () => {
    const full = await createEventFixture({ suffix: 'reg-full', audience: 'CLUB', capacity: 1 })
    expect((await postRegister('memberA', full.id)).statusCode).toBe(201)
    const fullSecond = await postRegister('memberB', full.id)
    expect(fullSecond.statusCode).toBe(409)
    expect(fullSecond.json().message).toContain('hết chỗ')

    // memberA hủy trả chỗ cho memberB, rồi memberB hủy; memberA đăng ký lại khi memberB đang giữ chỗ duy nhất → hết chỗ
    expect((await postCancel('memberA', full.id)).statusCode).toBe(200)
    expect((await postRegister('memberB', full.id)).statusCode).toBe(201)
    const again = await postRegister('memberA', full.id)
    expect(again.statusCode).toBe(409)
    expect(again.json().message).toContain('hết chỗ')
    const row = await db.eventRegistration.findUniqueOrThrow({
      where: { eventId_userId: { eventId: full.id, userId: users.memberA.id } },
    })
    expect(row.status).toBe('CANCELLED')
  })

  it('hai request đăng ký đồng thời vào sự kiện còn 1 chỗ chỉ có một thành công (BR-08)', async () => {
    const race = await createEventFixture({ suffix: 'reg-race', audience: 'CLUB', capacity: 1 })
    const [a, b] = await Promise.all([postRegister('memberA', race.id), postRegister('memberB', race.id)])
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409])
    expect(await db.eventRegistration.count({ where: { eventId: race.id, status: 'REGISTERED' } })).toBe(1)
  })

  it('chưa đăng nhập trả 401', async () => {
    const event = await createEventFixture({ suffix: 'reg-401', audience: 'CLUB' })
    const response = await postRegister(null, event.id)
    expect(response.statusCode).toBe(401)
  })
})

// ─── POST /portal/events/:id/registrations/cancel ─────────────────────────

describe('POST /portal/events/:id/registrations/cancel', () => {
  it('hủy thành công: CANCELLED kèm cancelledAt, có email xác nhận hủy, chỗ được trả lại (AC-09)', async () => {
    const event = await createEventFixture({ suffix: 'cancel-ok', audience: 'CLUB', capacity: 1 })
    expect((await postRegister('memberA', event.id)).statusCode).toBe(201)
    // Hết chỗ trước khi hủy: memberB không đăng ký được
    expect((await postRegister('memberB', event.id)).statusCode).toBe(409)

    const response = await postCancel('memberA', event.id)
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'CANCELLED' })
    expect(response.json().cancelledAt).toEqual(expect.any(String))

    const registration = await db.eventRegistration.findUniqueOrThrow({
      where: { eventId_userId: { eventId: event.id, userId: users.memberA.id } },
    })
    expect(registration.status).toBe('CANCELLED')
    expect(registration.cancelledAt).not.toBeNull()

    const delivery = await db.notificationDelivery.findFirst({
      where: { refType: 'EVENT_REGISTRATION', refId: registration.id, type: 'EVENT_REGISTRATION_CANCELLED_MEMBER' },
    })
    expect(delivery).toMatchObject({ recipient: `evt5-member-a-${tag}@test.local`, status: 'PENDING' })

    // Chỗ được trả lại: memberB đăng ký được ngay
    expect((await postRegister('memberB', event.id)).statusCode).toBe(201)
  })

  it('chưa đăng ký hoặc hủy hai lần → 409', async () => {
    const event = await createEventFixture({ suffix: 'cancel-none', audience: 'CLUB' })
    const first = await postCancel('memberA', event.id)
    expect(first.statusCode).toBe(409)
    expect(first.json().message).toContain('chưa đăng ký')

    expect((await postRegister('memberA', event.id)).statusCode).toBe(201)
    expect((await postCancel('memberA', event.id)).statusCode).toBe(200)
    const twice = await postCancel('memberA', event.id)
    expect(twice.statusCode).toBe(409)
  })

  it('hủy sau registrationClosesAt bị từ chối và giữ nguyên đăng ký (BR-08, FLOW-14)', async () => {
    const event = await createEventFixture({
      suffix: 'cancel-late',
      audience: 'CLUB',
      registrationClosesAt: inHours(-1),
    })
    const registration = await createMemberRegistration(event.id, users.memberA.id)

    const response = await postCancel('memberA', event.id)
    expect(response.statusCode).toBe(409)
    expect(response.json().message).toContain('hết thời hạn hủy')
    expect((await db.eventRegistration.findUniqueOrThrow({ where: { id: registration.id } })).status).toBe('REGISTERED')
  })

  it('hủy đăng ký sự kiện đã kết thúc (ENDED) bị từ chối dù registrationClosesAt để trống (BR-08)', async () => {
    const event = await createEventFixture({
      suffix: 'cancel-ended',
      audience: 'CLUB',
      status: 'ENDED',
      startInHours: -3,
      durationHours: 1,
    })
    await createMemberRegistration(event.id, users.memberA.id)

    const response = await postCancel('memberA', event.id)
    expect(response.statusCode).toBe(409)
    expect(response.json().message).toContain('không thể hủy đăng ký')
    expect(
      (await db.eventRegistration.findUnique({ where: { eventId_userId: { eventId: event.id, userId: users.memberA.id } } }))
        ?.status,
    ).toBe('REGISTERED')
  })

  it('sự kiện nội bộ ban khác → 404 như khi tra cứu danh sách (docs/02 mục 12)', async () => {
    const deptBEvent = await createEventFixture({ suffix: 'cancel-foreign', audience: 'DEPARTMENT', departmentId: deptB })
    expect((await postCancel('memberA', deptBEvent.id)).statusCode).toBe(404)
  })

  it('chưa đăng nhập trả 401', async () => {
    const event = await createEventFixture({ suffix: 'cancel-401', audience: 'CLUB' })
    const response = await postCancel(null, event.id)
    expect(response.statusCode).toBe(401)
  })
})

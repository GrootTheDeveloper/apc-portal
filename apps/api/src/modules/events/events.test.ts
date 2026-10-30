import { randomUUID } from 'node:crypto'

import type { FastifyBaseLogger } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { PRIVACY_POLICY_VERSION } from '../consent/service.js'
import { DUPLICATE_REGISTRATION_MESSAGE, endPastEvents } from './service.js'

// Test tích hợp với Postgres thật: tự tạo dữ liệu trong beforeAll, xóa sạch trong afterAll.
const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)

// Tag ngẫu nhiên để tránh va chạm giữa các lần chạy test song song
const tag = randomUUID().slice(0, 8)

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
// Việt Nam = UTC+7 cố định (BR-14), cùng công thức với service.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

const createdEventIds: string[] = []
const createdUserId: string[] = []
const createdDepartmentIds: string[] = []

// ─── HELPERS TẠO DỮ LIỆU TEST ─────────────────────────────────────────────

/** Tạo User tối giản để đáp ứng quan hệ bắt buộc createdById của Event. */
async function createAuthor() {
  const user = await db.user.create({
    data: {
      username: `author-events-${tag}`,
      email: `author-events-${tag}@test.local`,
      passwordHash: 'dummy-hash-not-used',
      fullName: 'Tác giả test',
      mustChangePassword: false,
      status: 'ACTIVE',
    },
  })
  createdUserId.push(user.id)
  return user
}

async function createEvent(
  opts: {
    suffix?: string
    status?: 'PUBLISHED' | 'DRAFT' | 'CANCELLED' | 'ENDED' | 'ARCHIVED'
    audience?: 'PUBLIC' | 'CLUB' | 'DEPARTMENT'
    eventType?: string
    startAt?: Date
    startInDays?: number
    durationHours?: number
    departmentId?: string
    contactPoint?: string
    location?: string | null
    onlineUrl?: string | null
    capacity?: number | null
    cancelReason?: string | null
    registrationOpensAt?: Date | null
    registrationClosesAt?: Date | null
    allowGuestRegistration?: boolean
  },
) {
  const suffix = opts.suffix ?? randomUUID().slice(0, 6)
  const startAt = opts.startAt ?? new Date(Date.now() + (opts.startInDays ?? 7) * DAY_MS)
  const endAt = new Date(startAt.getTime() + (opts.durationHours ?? 2) * HOUR_MS)
  const event = await db.event.create({
    data: {
      title: `Sự kiện ${suffix}`,
      slug: `su-kien-${suffix}-${tag}`,
      description: 'Mô tả sự kiện test.',
      eventType: opts.eventType ?? 'Workshop',
      status: opts.status ?? 'PUBLISHED',
      audience: opts.audience ?? 'PUBLIC',
      departmentId: opts.departmentId ?? null,
      contactPoint: opts.contactPoint ?? null,
      location: opts.location ?? null,
      onlineUrl: opts.onlineUrl ?? null,
      capacity: opts.capacity ?? null,
      cancelReason: opts.cancelReason ?? null,
      registrationOpensAt: opts.registrationOpensAt ?? null,
      registrationClosesAt: opts.registrationClosesAt ?? null,
      allowGuestRegistration: opts.allowGuestRegistration ?? true,
      createdById: authorId,
      startAt,
      endAt,
    },
  })
  createdEventIds.push(event.id)
  return event
}

/** Khóa tháng hiện tại theo ngày Việt Nam, dạng "YYYY-MM". */
function vnMonthKey(date = new Date()) {
  const vn = new Date(date.getTime() + VN_OFFSET_MS)
  return `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}`
}

const silentLog = { info: () => {}, warn: () => {}, error: () => {} } as unknown as FastifyBaseLogger

// ─── HELPERS E3: đăng ký của khách ────────────────────────────────────────

const ORIGIN = 'http://localhost:5173' // trùng WEB_URL mặc định; thiếu header Origin thì 403
let ipCounter = 0
// Mỗi request một IP riêng để ô rate limit của test này không đè lên test khác (SEC-05).
const nextIp = () => `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`

/** Thông tin khách hợp lệ; ghi đè từng trường qua `overrides`. */
const guestPayload = (suffix: string, overrides: Record<string, unknown> = {}) => ({
  fullName: `Khách test ${suffix}`,
  email: `guest-${suffix}-${tag}@test.local`,
  studentId: `SV${tag}${suffix.replaceAll('-', '').slice(0, 4).toUpperCase()}`,
  consent: true,
  ...overrides,
})

function postJson(path: string, payload: Record<string, unknown>, options: { ip?: string } = {}) {
  return app.inject({
    method: 'POST',
    url: path,
    payload,
    headers: { origin: ORIGIN },
    remoteAddress: options.ip ?? nextIp(),
  })
}

const postRegister = (slug: string, payload: Record<string, unknown>, options?: { ip?: string }) =>
  postJson(`/public/events/${slug}/registrations`, payload, options)
const postLookup = (payload: Record<string, unknown>, options?: { ip?: string }) =>
  postJson('/public/event-registrations/lookup', payload, options)
const postCancel = (payload: Record<string, unknown>, options?: { ip?: string }) =>
  postJson('/public/event-registrations/cancel', payload, options)

// ─── SETUP / TEARDOWN ──────────────────────────────────────────────────────

let authorId: string

beforeAll(async () => {
  const author = await createAuthor()
  authorId = author.id
  await app.ready()
})

afterAll(async () => {
  // Dữ liệu nối với đăng ký (đồng ý, email) xóa trước theo refId của đăng ký (không có FK, tự dọn để không còn dòng mồ côi).
  const registrationIds = (
    await db.eventRegistration.findMany({ where: { eventId: { in: createdEventIds } }, select: { id: true } })
  ).map((registration) => registration.id)
  await db.notificationDelivery.deleteMany({ where: { refType: 'EVENT_REGISTRATION', refId: { in: registrationIds } } })
  await db.consentRecord.deleteMany({ where: { subjectType: 'EVENT_REGISTRATION', subjectId: { in: registrationIds } } })
  await db.eventRegistration.deleteMany({ where: { eventId: { in: createdEventIds } } })
  await db.event.deleteMany({ where: { id: { in: createdEventIds } } })
  await db.auditLog.deleteMany({ where: { action: 'event.end', serviceName: 'event-end' } })
  await db.department.deleteMany({ where: { id: { in: createdDepartmentIds } } })
  await db.user.deleteMany({ where: { id: { in: createdUserId } } })
  await app.close()
  await db.$disconnect()
})

// ─── GET /public/events ───────────────────────────────────────────────────

describe('GET /public/events', () => {
  it('trả về sự kiện PUBLIC ở PUBLISHED/CANCELLED/ENDED, ẩn DRAFT/ARCHIVED/nội bộ, xếp sự kiện sắp diễn ra trước', async () => {
    const upcoming1 = await createEvent({ suffix: 'up1', startInDays: 1 })
    const upcoming2 = await createEvent({ suffix: 'up2', startInDays: 2 })
    const cancelled = await createEvent({ suffix: 'cancelled', status: 'CANCELLED', startInDays: 10 })
    const ended = await createEvent({ suffix: 'ended', status: 'ENDED', startInDays: -5 })
    await createEvent({ suffix: 'draft', status: 'DRAFT', startInDays: 3 })
    await createEvent({ suffix: 'archived', status: 'ARCHIVED', startInDays: -6 })
    await createEvent({ suffix: 'club', audience: 'CLUB' })
    await createEvent({ suffix: 'dept', audience: 'DEPARTMENT' })

    const response = await app.inject({ method: 'GET', url: '/public/events' })
    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body).toMatchObject({ items: expect.any(Array), total: expect.any(Number), page: 1 })
    for (const item of body.items) {
      expect(item).toHaveProperty('slug')
      expect(item).toHaveProperty('title')
      expect(item).toHaveProperty('eventType')
      expect(item).toHaveProperty('status')
      expect(item).toHaveProperty('startAt')
      expect(item).toHaveProperty('endAt')
      // Trường nội bộ KHÔNG được lộ
      expect(item).not.toHaveProperty('id')
      expect(item).not.toHaveProperty('createdById')
      expect(item).not.toHaveProperty('departmentId')
      expect(item).not.toHaveProperty('audience')
      expect(item).not.toHaveProperty('cancelReason')
    }

    // Chỉ các sự kiện PUBLIC của test này, đúng thứ tự upcoming → cancelled → ended
    const publicSlugs = body.items
      .map((item: { slug: string }) => item.slug)
      .filter((slug: string) => ['up1', 'up2', 'cancelled', 'ended'].some((suffix) => slug.includes(`su-kien-${suffix}-${tag}`)))
    expect(publicSlugs).toEqual([upcoming1.slug, upcoming2.slug, cancelled.slug, ended.slug])

    // Sự kiện nháp, lưu trữ, nội bộ không có trong danh sách
    const allSlugs: string[] = body.items.map((item: { slug: string }) => item.slug)
    for (const suffix of ['draft', 'archived', 'club', 'dept']) {
      expect(allSlugs).not.toContain(`su-kien-${suffix}-${tag}`)
    }
  })

  it('lọc đúng theo type', async () => {
    const workshop = await createEvent({ suffix: 'ws', eventType: 'Workshop' })
    await createEvent({ suffix: 'contest', eventType: 'Cuộc thi' })

    const response = await app.inject({ method: 'GET', url: `/public/events?type=${encodeURIComponent('Workshop')}` })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    const slugs: string[] = body.items.map((item: { slug: string }) => item.slug)

    expect(body.items.every((item: { eventType: string }) => item.eventType === 'Workshop')).toBe(true)
    expect(slugs).toContain(workshop.slug)
    expect(slugs).not.toContain(`su-kien-contest-${tag}`)
  })

  it('lọc theo month theo ngày Việt Nam: sự kiện đêm cuối tháng thuộc tháng VN', async () => {
    // Cùng công thức cửa sổ tháng với service: [đầu tháng VN, đầu tháng sau VN) quy về UTC.
    const [year, month] = vnMonthKey().split('-').map(Number) as [number, number]
    const windowEnd = new Date(Date.UTC(year, month, 1) - VN_OFFSET_MS) // 00:00 VN ngày 1 tháng sau

    const inMonth = await createEvent({ suffix: 'in-month', startAt: new Date(windowEnd.getTime() - 2 * HOUR_MS) }) // 22:00 VN ngày cuối tháng
    const outMonth = await createEvent({ suffix: 'out-month', startAt: new Date(windowEnd.getTime() + 1 * HOUR_MS) }) // 01:00 VN tháng sau

    const response = await app.inject({ method: 'GET', url: `/public/events?month=${vnMonthKey()}` })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    const slugs: string[] = body.items.map((item: { slug: string }) => item.slug)

    expect(slugs).toContain(inMonth.slug)
    expect(slugs).not.toContain(outMonth.slug)
  })

  it('upcoming=1 chỉ trả sự kiện PUBLISHED chưa qua endAt', async () => {
    const future = await createEvent({ suffix: 'upcoming-future', startInDays: 3 })
    await createEvent({ suffix: 'upcoming-past', startInDays: -2, durationHours: 1 }) // PUBLISHED nhưng đã qua endAt

    const response = await app.inject({ method: 'GET', url: '/public/events?upcoming=1' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    const slugs: string[] = body.items.map((item: { slug: string }) => item.slug)

    expect(slugs).toContain(future.slug)
    expect(slugs).not.toContain(`su-kien-upcoming-past-${tag}`)
  })

  it('hỗ trợ phân trang', async () => {
    const response = await app.inject({ method: 'GET', url: '/public/events?page=1&pageSize=2' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body).toMatchObject({ page: 1, pageSize: 2 })
    expect(body.items.length).toBeLessThanOrEqual(2)
  })

  it('month sai định dạng trả 422', async () => {
    const response = await app.inject({ method: 'GET', url: '/public/events?month=2026-13' })
    expect(response.statusCode).toBe(422)
    expect(response.json().error).toBe('validation')
  })
})

// ─── GET /public/events/:slug ─────────────────────────────────────────────

describe('GET /public/events/:slug', () => {
  it('trả về chi tiết đầy đủ của sự kiện công khai, có tên ban tổ chức', async () => {
    const department = await db.department.create({
      data: { name: `Ban test ${tag}`, code: `ban-test-${tag}` },
    })
    createdDepartmentIds.push(department.id)

    const event = await createEvent({
      suffix: 'detail-ok',
      departmentId: department.id,
      contactPoint: 'Ban test APC',
      location: 'Lab Công Nghệ UMT',
      capacity: 40,
    })

    const response = await app.inject({ method: 'GET', url: `/public/events/${event.slug}` })
    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.slug).toBe(event.slug)
    expect(body.title).toBe(event.title)
    expect(body.description).toBe('Mô tả sự kiện test.')
    expect(body.departmentName).toBe(`Ban test ${tag}`)
    expect(body.contactPoint).toBe('Ban test APC')
    expect(body.capacity).toBe(40)
    // Trường nội bộ KHÔNG được lộ
    expect(body).not.toHaveProperty('createdById')
    expect(body).not.toHaveProperty('departmentId')
    expect(body).not.toHaveProperty('audience')
    expect(body).not.toHaveProperty('attendanceFinalizedAt')
  })

  it('sự kiện CANCELLED trả kèm cancelReason', async () => {
    const event = await createEvent({ suffix: 'detail-cancelled', status: 'CANCELLED', cancelReason: 'Trùng lịch kiểm tra.' })
    const response = await app.inject({ method: 'GET', url: `/public/events/${event.slug}` })
    expect(response.statusCode).toBe(200)
    expect(response.json().cancelReason).toBe('Trùng lịch kiểm tra.')
  })

  it('trả 404 với sự kiện DRAFT', async () => {
    const event = await createEvent({ suffix: 'detail-draft', status: 'DRAFT' })
    const response = await app.inject({ method: 'GET', url: `/public/events/${event.slug}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })

  it('trả 404 với sự kiện ARCHIVED', async () => {
    const event = await createEvent({ suffix: 'detail-archived', status: 'ARCHIVED' })
    const response = await app.inject({ method: 'GET', url: `/public/events/${event.slug}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })

  it('trả 404 với sự kiện nội bộ CLUB dù đã công bố', async () => {
    const event = await createEvent({ suffix: 'detail-club', audience: 'CLUB' })
    const response = await app.inject({ method: 'GET', url: `/public/events/${event.slug}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })

  it('trả 404 với sự kiện nội bộ DEPARTMENT dù đã công bố', async () => {
    const event = await createEvent({ suffix: 'detail-dept', audience: 'DEPARTMENT' })
    const response = await app.inject({ method: 'GET', url: `/public/events/${event.slug}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })

  it('trả 404 với slug không tồn tại', async () => {
    const response = await app.inject({ method: 'GET', url: `/public/events/su-kien-khong-ton-tai-${tag}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })
})

// ─── POST /public/events/:slug/registrations (E3) ─────────────────────────

describe('POST /public/events/:slug/registrations', () => {
  it('đăng ký thành công: trả mỗi mình mã đăng ký một lần, lưu đăng ký + đồng ý + xếp email xác nhận', async () => {
    const event = await createEvent({ suffix: 'reg-ok', capacity: 30 })
    const payload = guestPayload('regok')

    const response = await postRegister(event.slug, payload)
    expect(response.statusCode).toBe(201)
    // STATE-02: màn hình chỉ nhận mã đăng ký, không kèm dữ liệu nào khác
    const body = response.json()
    expect(Object.keys(body)).toEqual(['registrationCode'])
    expect(body.registrationCode).toMatch(/^[23456789A-Z]{12}$/)

    const registration = await db.eventRegistration.findUniqueOrThrow({ where: { registrationCode: body.registrationCode } })
    expect(registration).toMatchObject({
      eventId: event.id,
      guestEmail: payload.email,
      guestStudentId: payload.studentId,
      status: 'REGISTERED',
      attendanceStatus: 'NOT_MARKED',
    })

    // Đồng ý xử lý dữ liệu lưu trong cùng transaction (DATA-07)
    const consent = await db.consentRecord.findFirst({
      where: { subjectType: 'EVENT_REGISTRATION', subjectId: registration.id, purpose: 'EVENT_REGISTRATION' },
    })
    expect(consent).toMatchObject({ policyVersion: PRIVACY_POLICY_VERSION, revokedAt: null })

    // Email xác nhận xếp hàng đợi trong cùng transaction; SMTP lỗi thì thử lại, đăng ký vẫn giữ (BR-17)
    const delivery = await db.notificationDelivery.findFirst({ where: { refType: 'EVENT_REGISTRATION', refId: registration.id } })
    expect(delivery).toMatchObject({ type: 'EVENT_REGISTRATION_CONFIRMED', recipient: payload.email, status: 'PENDING' })
  })

  it('đăng ký trùng email nhận 409 với câu chung, phản hồi không có mã hay dữ liệu của đăng ký đã có (QĐ-1)', async () => {
    const event = await createEvent({ suffix: 'reg-dup' })
    const payload = guestPayload('regdup')
    expect((await postRegister(event.slug, payload)).statusCode).toBe(201)

    const second = await postRegister(event.slug, guestPayload('regdup2', { email: payload.email }))
    expect(second.statusCode).toBe(409)
    // Đúng câu chung, chỉ có { error, message }: không trả mã, trạng thái hay bất kỳ dữ liệu nào (SEC-05, SEC-08)
    expect(second.json()).toEqual({ error: 'conflict', message: DUPLICATE_REGISTRATION_MESSAGE })
  })

  it('chưa tick ô đồng ý → 422, không tạo đăng ký', async () => {
    const event = await createEvent({ suffix: 'reg-consent' })
    const payload = guestPayload('regconsent', { consent: false })

    const response = await postRegister(event.slug, payload)
    expect(response.statusCode).toBe(422)
    expect(response.json().error).toBe('validation')
    expect(await db.eventRegistration.count({ where: { eventId: event.id, guestEmail: payload.email } })).toBe(0)
  })

  it('chặn đăng ký và nêu rõ lý do: chưa mở, hết hạn, hết chỗ, không nhận khách, đã hủy, đã kết thúc', async () => {
    const now = Date.now()
    const notOpen = await createEvent({
      suffix: 'reg-notopen',
      registrationOpensAt: new Date(now + DAY_MS),
      registrationClosesAt: new Date(now + 2 * DAY_MS),
    })
    const closed = await createEvent({ suffix: 'reg-closed', registrationClosesAt: new Date(now - HOUR_MS) })
    const guestsOff = await createEvent({ suffix: 'reg-guests-off', allowGuestRegistration: false })
    const cancelled = await createEvent({ suffix: 'reg-cancelled', status: 'CANCELLED' })
    const ended = await createEvent({ suffix: 'reg-ended', status: 'ENDED' })
    const full = await createEvent({ suffix: 'reg-full', capacity: 1 })

    expect((await postRegister(notOpen.slug, guestPayload('a1'))).json().message).toContain('chưa mở đăng ký')
    expect((await postRegister(closed.slug, guestPayload('a2'))).json().message).toContain('hết thời hạn đăng ký')
    expect((await postRegister(guestsOff.slug, guestPayload('a3'))).json().message).toContain('khách ngoài APC')
    expect((await postRegister(cancelled.slug, guestPayload('a4'))).json().message).toContain('đã bị hủy')
    expect((await postRegister(ended.slug, guestPayload('a5'))).json().message).toContain('đã kết thúc')

    // Hết chỗ: lượt đầu chiếm chỗ duy nhất, lượt sau (email khác) nhận 409 vì hết chỗ
    expect((await postRegister(full.slug, guestPayload('a6'))).statusCode).toBe(201)
    const fullSecond = await postRegister(full.slug, guestPayload('a7'))
    expect(fullSecond.statusCode).toBe(409)
    expect(fullSecond.json().message).toContain('hết chỗ')
  })

  it('sự kiện nội bộ (CLUB) hoặc slug không tồn tại → 404, không tiết lộ sự kiện có tồn tại', async () => {
    const club = await createEvent({ suffix: 'reg-club', audience: 'CLUB' })
    expect((await postRegister(club.slug, guestPayload('b1'))).statusCode).toBe(404)
    expect((await postRegister(`khong-ton-tai-${tag}`, guestPayload('b2'))).statusCode).toBe(404)
  })

  it('hủy rồi đăng ký lại kích hoạt dòng cũ: cùng id, cùng mã, về REGISTERED (E2)', async () => {
    const event = await createEvent({ suffix: 'reg-reactivate' })
    const payload = guestPayload('regreact')

    const { registrationCode } = (await postRegister(event.slug, payload)).json()
    const original = await db.eventRegistration.findUniqueOrThrow({ where: { registrationCode } })
    expect((await postCancel({ email: payload.email, code: registrationCode })).statusCode).toBe(200)

    const again = await postRegister(event.slug, payload)
    expect(again.statusCode).toBe(201)
    expect(again.json().registrationCode).toBe(registrationCode)

    const row = await db.eventRegistration.findUniqueOrThrow({ where: { registrationCode } })
    expect(row.id).toBe(original.id)
    expect(row.status).toBe('REGISTERED')
    expect(row.cancelledAt).toBeNull()
    // Đăng ký lại cũng có email xác nhận riêng (đăng ký + hủy + đăng ký lại = 2 email xác nhận, 1 email hủy)
    const confirmations = await db.notificationDelivery.findMany({
      where: { refType: 'EVENT_REGISTRATION', refId: original.id, type: 'EVENT_REGISTRATION_CONFIRMED' },
    })
    expect(confirmations).toHaveLength(2)
  })

  it('hai request đăng ký đồng thời vào sự kiện còn 1 chỗ chỉ có một request thành công (BR-08)', async () => {
    const event = await createEvent({ suffix: 'reg-race', capacity: 1 })
    const [a, b] = await Promise.all([
      postRegister(event.slug, guestPayload('race1')),
      postRegister(event.slug, guestPayload('race2')),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409])
    expect(await db.eventRegistration.count({ where: { eventId: event.id, status: 'REGISTERED' } })).toBe(1)
  })

  it('chặn lạm dụng form công khai: lượt thứ 11 trong 15 phút từ cùng IP + email nhận 429 (SEC-05)', async () => {
    const event = await createEvent({ suffix: 'reg-flood' })
    const ip = nextIp()
    const payload = guestPayload('regflood', { email: `flood-${tag}@test.local` })

    const statuses: number[] = []
    for (let attempt = 0; attempt < 11; attempt++) {
      statuses.push((await postRegister(event.slug, payload, { ip })).statusCode)
    }
    expect(statuses[0]).toBe(201) // lượt đầu thành công
    expect(statuses.slice(1, 10).every((status) => status === 409)).toBe(true) // lượt 2–10 trùng email
    expect(statuses[10]).toBe(429) // lượt 11 vượt giới hạn tần suất
  })
})

// ─── POST /public/event-registrations/lookup (E3) ─────────────────────────

describe('POST /public/event-registrations/lookup', () => {
  it('tra cứu đúng email + mã trả thông tin đăng ký và tóm tắt sự kiện, không lộ trường nội bộ', async () => {
    const event = await createEvent({ suffix: 'lookup-ok' })
    const payload = guestPayload('lookupok')
    const { registrationCode } = (await postRegister(event.slug, payload)).json()

    const response = await postLookup({ email: payload.email, code: registrationCode })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body).toMatchObject({
      guestFullName: payload.fullName,
      guestEmail: payload.email,
      status: 'REGISTERED',
      registeredAt: expect.any(String),
      event: { slug: event.slug, title: event.title, status: 'PUBLISHED', departmentName: null },
    })
    expect(body.cancelledAt).toBeNull()
    // BR-09, SEC-08: chỉ thông tin của chính người tra cứu, không trường nội bộ của sự kiện
    expect(body).not.toHaveProperty('registrationCode')
    for (const field of ['id', 'createdById', 'departmentId', 'department', 'audience', 'capacity', 'allowGuestRegistration']) {
      expect(body.event).not.toHaveProperty(field)
    }
  })

  it('sai email hoặc sai mã đều một câu lỗi chung, không cho biết phần nào sai', async () => {
    const event = await createEvent({ suffix: 'lookup-miss' })
    const payload = guestPayload('lookupmiss')
    const { registrationCode } = (await postRegister(event.slug, payload)).json()

    const wrongCode = await postLookup({ email: payload.email, code: 'XXXXXXXXXXXX' })
    const wrongEmail = await postLookup({ email: `other-${tag}@test.local`, code: registrationCode })
    expect(wrongCode.statusCode).toBe(404)
    expect(wrongEmail.statusCode).toBe(404)
    expect(wrongCode.json()).toEqual(wrongEmail.json())
  })

  it('đăng ký đã hủy vẫn tra cứu được với status CANCELLED', async () => {
    const event = await createEvent({ suffix: 'lookup-cancelled' })
    const payload = guestPayload('lookupcancelled')
    const { registrationCode } = (await postRegister(event.slug, payload)).json()
    await postCancel({ email: payload.email, code: registrationCode })

    const response = await postLookup({ email: payload.email, code: registrationCode })
    expect(response.statusCode).toBe(200)
    expect(response.json().status).toBe('CANCELLED')
    expect(response.json().cancelledAt).not.toBeNull()
  })

  it('tra cứu sai lần thứ 6 trong 15 phút (cùng IP + email) nhận 429 với mã rate_limited (cùng quy tắc R4)', async () => {
    const event = await createEvent({ suffix: 'lookup-flood' })
    const ip = nextIp()
    const payload = { email: `lookup-flood-${tag}@test.local`, code: 'YYYYYYYYYYYY' }

    const statuses: number[] = []
    for (let attempt = 0; attempt < 6; attempt++) {
      statuses.push((await postLookup(payload, { ip })).statusCode)
    }
    expect(statuses.slice(0, 5).every((status) => status === 404)).toBe(true)
    expect(statuses[5]).toBe(429)
    expect((await postLookup(payload, { ip })).json().error).toBe('rate_limited')
  })
})

// ─── POST /public/event-registrations/cancel (E3) ─────────────────────────

describe('POST /public/event-registrations/cancel', () => {
  it('hủy thành công: CANCELLED kèm cancelledAt, có email xác nhận hủy, chỗ được trả lại (AC-09)', async () => {
    const event = await createEvent({ suffix: 'cancel-ok', capacity: 1 })
    const payload = guestPayload('cancelok')
    const { registrationCode } = (await postRegister(event.slug, payload)).json()

    // Hết chỗ trước khi hủy: người khác không đăng ký được
    expect((await postRegister(event.slug, guestPayload('cancelok2'))).statusCode).toBe(409)

    const response = await postCancel({ email: payload.email, code: registrationCode })
    expect(response.statusCode).toBe(200)
    expect(response.json().status).toBe('CANCELLED')

    const row = await db.eventRegistration.findUniqueOrThrow({ where: { registrationCode } })
    expect(row.status).toBe('CANCELLED')
    expect(row.cancelledAt).not.toBeNull()
    // Chỗ được trả lại: người khác đăng ký được ngay
    expect((await postRegister(event.slug, guestPayload('cancelok3'))).statusCode).toBe(201)

    const delivery = await db.notificationDelivery.findFirst({
      where: { refType: 'EVENT_REGISTRATION', refId: row.id, type: 'EVENT_REGISTRATION_CANCELLED' },
    })
    expect(delivery).toMatchObject({ recipient: payload.email, status: 'PENDING' })
  })

  it('sai mã → 404 câu chung như tra cứu; hủy hai lần → 409', async () => {
    const event = await createEvent({ suffix: 'cancel-miss' })
    const payload = guestPayload('cancelmiss')
    const { registrationCode } = (await postRegister(event.slug, payload)).json()

    const wrongCode = await postCancel({ email: payload.email, code: 'ZZZZZZZZZZZZ' })
    expect(wrongCode.statusCode).toBe(404)
    expect(wrongCode.json()).toEqual((await postLookup({ email: payload.email, code: 'ZZZZZZZZZZZZ' })).json())

    expect((await postCancel({ email: payload.email, code: registrationCode })).statusCode).toBe(200)
    const twice = await postCancel({ email: payload.email, code: registrationCode })
    expect(twice.statusCode).toBe(409)
    expect(twice.json().message).toContain('đã được hủy trước đó')
  })

  it('hủy sau registrationClosesAt bị từ chối và giữ nguyên đăng ký (FLOW-14)', async () => {
    const event = await createEvent({ suffix: 'cancel-late', registrationClosesAt: new Date(Date.now() - HOUR_MS) })
    // Tạo đăng ký trực tiếp vì cửa sổ đăng ký đã đóng, không đăng ký qua API được
    const registration = await db.eventRegistration.create({
      data: {
        eventId: event.id,
        guestFullName: 'Khách muộn',
        guestEmail: `late-${tag}@test.local`,
        guestStudentId: `SV${tag}`,
        registrationCode: 'LATECODE2345',
      },
    })

    const response = await postCancel({ email: registration.guestEmail, code: registration.registrationCode })
    expect(response.statusCode).toBe(409)
    expect(response.json().message).toContain('hết thời hạn hủy')
    expect((await db.eventRegistration.findUniqueOrThrow({ where: { id: registration.id } })).status).toBe('REGISTERED')
  })
})

// ─── TÁC VỤ NỀN endPastEvents ────────────────────────────────────────────

describe('endPastEvents', () => {
  it('chuyển PUBLISHED đã qua endAt sang ENDED, giữ nguyên các trạng thái khác và ghi audit dịch vụ', async () => {
    const past = await createEvent({ suffix: 'job-past', startInDays: -2, durationHours: 1 })
    const future = await createEvent({ suffix: 'job-future', startInDays: 3 })
    const cancelled = await createEvent({ suffix: 'job-cancelled', status: 'CANCELLED', startInDays: -3 })
    const draft = await createEvent({ suffix: 'job-draft', status: 'DRAFT', startInDays: -3 })

    const result = await endPastEvents(silentLog)
    expect(result.ended).toBeGreaterThanOrEqual(1)

    const statuses = await db.event.findMany({
      where: { id: { in: [past.id, future.id, cancelled.id, draft.id] } },
      select: { id: true, status: true },
    })
    const statusOf = (id: string) => statuses.find((event) => event.id === id)?.status
    expect(statusOf(past.id)).toBe('ENDED')
    expect(statusOf(future.id)).toBe('PUBLISHED')
    expect(statusOf(cancelled.id)).toBe('CANCELLED')
    expect(statusOf(draft.id)).toBe('DRAFT')

    // Nhật ký gộp bằng định danh dịch vụ, không dùng tài khoản cá nhân
    const auditLog = await db.auditLog.findFirst({
      where: { action: 'event.end', serviceName: 'event-end' },
      orderBy: { createdAt: 'desc' },
    })
    expect(auditLog).toMatchObject({ actorType: 'SERVICE', result: 'SUCCESS', category: 'BUSINESS' })

    // Chạy lại: sự kiện của test này không đổi thêm (past đã ENDED ở lượt trước)
    await endPastEvents(silentLog)
    const statusAfterSecondRun = await db.event.findMany({
      where: { id: { in: [past.id, future.id] } },
      select: { id: true, status: true },
    })
    expect(statusAfterSecondRun.find((event) => event.id === past.id)?.status).toBe('ENDED')
    expect(statusAfterSecondRun.find((event) => event.id === future.id)?.status).toBe('PUBLISHED')
  })
})

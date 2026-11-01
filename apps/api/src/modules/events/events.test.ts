import { randomUUID } from 'node:crypto'

import type { FastifyBaseLogger } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { endPastEvents } from './service.js'

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

// ─── SETUP / TEARDOWN ──────────────────────────────────────────────────────

let authorId: string

beforeAll(async () => {
  const author = await createAuthor()
  authorId = author.id
  await app.ready()
})

afterAll(async () => {
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

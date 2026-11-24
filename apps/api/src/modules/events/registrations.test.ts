import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { AuthUser } from '../auth/rbac.js'
import { createMemoryStorage } from '../files/storage.js'

// Test tích hợp E6 (FLOW-16): danh sách đăng ký, xuất CSV qua D6, điểm danh, chốt điểm danh và
// lịch sử hoạt động thành viên. Người dùng giả qua header x-test-user như admin.test.ts; POST/PATCH
// gửi Origin đúng WEB_URL để qua kiểm tra CSRF. Dùng kho tệp trong bộ nhớ để tải file xuất được.
const config = loadConfig({ NODE_ENV: 'test' })
const ORIGIN = 'http://localhost:5173'
const tag = randomUUID().slice(0, 8)

type UserKey = 'manager' | 'managerB' | 'board' | 'memberA' | 'memberB'
const users = {} as Record<UserKey, AuthUser>
const userIds: string[] = []
const departmentIds: string[] = []
const eventIds: string[] = []
const registrationIds: string[] = []
const exportIds: string[] = []

const memory = createMemoryStorage()
const app = buildApp(config, { storage: memory.storage })

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

/** Tạo sự kiện PUBLISHED trực tiếp trong DB (điểm danh không phụ thuộc trạng thái, mặc định PUBLISHED). */
async function createEventFixture(departmentId: string) {
  const suffix = randomUUID().slice(0, 6)
  const event = await db.event.create({
    data: {
      title: `Sự kiện E6 ${suffix}`,
      slug: `evt-e6-${suffix}-${tag}`,
      description: 'Mô tả sự kiện test điểm danh.',
      eventType: 'Workshop',
      status: 'PUBLISHED',
      audience: 'DEPARTMENT',
      departmentId,
      createdById: userIds[0]!,
      startAt: new Date(Date.now() + 48 * 3_600_000),
      endAt: new Date(Date.now() + 50 * 3_600_000),
    },
  })
  eventIds.push(event.id)
  return event
}

/** Tạo đăng ký: hoặc thành viên (userId) hoặc khách (họ tên, email, MSSV) — như E3/E5 tạo. */
async function createRegistration(
  eventId: string,
  data: { userId?: string; fullName?: string; email?: string; studentId?: string; status?: 'REGISTERED' | 'CANCELLED' },
) {
  const registration = await db.eventRegistration.create({
    data: {
      eventId,
      ...(data.userId ? { userId: data.userId } : {
        guestFullName: data.fullName ?? 'Khách test',
        guestEmail: data.email ?? `guest-${randomUUID().slice(0, 6)}@test.local`,
        guestStudentId: data.studentId ?? 'K220000',
      }),
      registrationCode: randomUUID().slice(0, 12).toUpperCase(),
      ...(data.status === 'CANCELLED' ? { status: 'CANCELLED' as const, cancelledAt: new Date() } : {}),
    },
  })
  registrationIds.push(registration.id)
  return registration
}

let eventA = ''
let eventB = ''
let memberRegA = ''
let guestRegA = ''
let cancelledRegA = ''
let memberRegB = ''

beforeAll(async () => {
  app.addHook('onRequest', async (request) => {
    const key = request.headers['x-test-user'] as UserKey | undefined
    request.user = key && users[key] ? users[key] : null
  })
  await app.ready()

  const [a, b] = await Promise.all([
    db.department.create({ data: { name: `Ban A ${tag}`, code: `evt6-a-${tag}` } }),
    db.department.create({ data: { name: `Ban B ${tag}`, code: `evt6-b-${tag}` } }),
  ])
  departmentIds.push(a.id, b.id)

  const mkUser = async (key: string, departmentId: string | null) => {
    const user = await db.user.create({
      data: {
        username: `evt6-${key}-${tag}`,
        email: `evt6-${key}-${tag}@test.local`,
        passwordHash: 'khong-dung',
        fullName: `Người E6 ${key}`,
        departmentId,
        mustChangePassword: false,
      },
    })
    userIds.push(user.id)
    return user
  }

  const managerA = await mkUser('manager', a.id)
  const managerB = await mkUser('managerB', b.id)
  const board = await mkUser('board', null)
  const memberA = await mkUser('memberA', a.id)
  const memberB = await mkUser('memberB', b.id)

  // roles luôn có dòng MEMBER nền (RP-01); rbac đọc request.user do hook gắn, không cần dòng user_roles.
  const base = (departmentId: string | null) => ({ role: 'MEMBER' as const, departmentId })
  users.manager = { id: managerA.id, departmentId: a.id, roles: [base(a.id), { role: 'DEPARTMENT_MANAGER', departmentId: a.id }] }
  users.managerB = { id: managerB.id, departmentId: b.id, roles: [base(b.id), { role: 'DEPARTMENT_MANAGER', departmentId: b.id }] }
  users.board = { id: board.id, departmentId: null, roles: [base(null), { role: 'BOARD', departmentId: null }] }
  users.memberA = { id: memberA.id, departmentId: a.id, roles: [base(a.id)] }
  users.memberB = { id: memberB.id, departmentId: b.id, roles: [base(b.id)] }

  eventA = (await createEventFixture(a.id)).id
  eventB = (await createEventFixture(b.id)).id

  memberRegA = (await createRegistration(eventA, { userId: memberA.id })).id
  guestRegA = (
    await createRegistration(eventA, { fullName: `Nguyễn Thị Khách ${tag}`, email: `khach-${tag}@test.local`, studentId: 'K2255501' })
  ).id
  cancelledRegA = (await createRegistration(eventA, { fullName: 'Khách đã hủy', status: 'CANCELLED' })).id
  memberRegB = (await createRegistration(eventB, { userId: memberB.id })).id
})

afterAll(async () => {
  await app.close()
  // 401/403 bị chặn cũng ghi audit (actorId là người gọi); xuất file audit theo targetId EXPORT_FILE.
  await db.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: userIds } },
        { targetId: { in: [...eventIds, ...registrationIds, ...exportIds] } },
      ],
    },
  })
  await db.exportFile.deleteMany({
    where: { OR: [{ id: { in: exportIds } }, { createdById: { in: userIds } }, { downloaderId: { in: userIds } }] },
  })
  await db.eventRegistration.deleteMany({ where: { eventId: { in: eventIds } } })
  await db.event.deleteMany({ where: { id: { in: eventIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await db.department.deleteMany({ where: { id: { in: departmentIds } } })
})

// ─── POST /admin/events/:id/registrations/search ─────────────────────────────

describe('POST /admin/events/:id/registrations/search', () => {
  it('manager Ban A thấy danh sách đăng ký sự kiện ban mình, tách thành viên/khách, không lộ mã đăng ký', async () => {
    const response = await post('manager', `/admin/events/${eventA}/registrations/search`, {})
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body).toEqual(expect.objectContaining({ page: 1, pageSize: 20 }))
    const items = body.items as {
      id: string
      attendeeType: string
      fullName: string | null
      email: string | null
      registrationCode?: string
    }[]
    const byId = new Map(items.map((item) => [item.id, item]))

    // Thành viên: tên/email lấy từ tài khoản; khách: từ thông tin đăng ký (E3).
    expect(byId.get(memberRegA)).toEqual(
      expect.objectContaining({ attendeeType: 'MEMBER', fullName: 'Người E6 memberA', status: 'REGISTERED' }),
    )
    expect(byId.get(guestRegA)).toEqual(
      expect.objectContaining({ attendeeType: 'GUEST', fullName: `Nguyễn Thị Khách ${tag}`, email: `khach-${tag}@test.local` }),
    )
    expect(byId.get(cancelledRegA)).toEqual(expect.objectContaining({ attendeeType: 'GUEST', status: 'CANCELLED' }))
    for (const item of items) {
      // Mã đăng ký chỉ người đăng ký dùng để tra cứu/hủy — danh sách quản trị không trả (SEC-09).
      expect(item.registrationCode).toBeUndefined()
    }
  })

  it('manager Ban A mở danh sách đăng ký sự kiện Ban B nhận 404', async () => {
    const response = await post('manager', `/admin/events/${eventB}/registrations/search`, {})
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })

  it('tìm theo tên/email và lọc trạng thái đăng ký', async () => {
    // Tìm tên khách khớp một dòng
    const byName = await post('manager', `/admin/events/${eventA}/registrations/search`, { search: `Nguyễn Thị Khách ${tag}` })
    expect(byName.statusCode).toBe(200)
    expect((byName.json().items as { id: string }[]).map((item) => item.id)).toEqual([guestRegA])

    // Tìm email thành viên khớp dòng của thành viên
    const byEmail = await post('manager', `/admin/events/${eventA}/registrations/search`, {
      search: `evt6-membera-${tag}@test.local`,
    })
    expect(byEmail.statusCode).toBe(200)
    expect((byEmail.json().items as { id: string }[]).map((item) => item.id)).toEqual([memberRegA])

    // Lọc trạng thái: chỉ còn các đăng ký đã hủy
    const cancelled = await post('manager', `/admin/events/${eventA}/registrations/search`, { status: 'CANCELLED' })
    expect(cancelled.statusCode).toBe(200)
    expect((cancelled.json().items as { id: string }[]).map((item) => item.id)).toEqual([cancelledRegA])
  })

  it('chưa đăng nhập trả 401, thành viên thường trả 403', async () => {
    expect((await post(null, `/admin/events/${eventA}/registrations/search`, {})).statusCode).toBe(401)
    expect((await post('memberA', `/admin/events/${eventA}/registrations/search`, {})).statusCode).toBe(403)
  })
})

// ─── POST /admin/events/:id/registrations/export ─────────────────────────────

describe('POST /admin/events/:id/registrations/export', () => {
  it('manager xuất CSV: file READY, chỉ người tạo tải được, có BOM và giữ tiếng Việt, ghi audit event.export', async () => {
    const response = await post('manager', `/admin/events/${eventA}/registrations/export`, {})
    expect(response.statusCode).toBe(200)
    const created = response.json() as { id: string; status: string; filename: string }
    expect(created.status).toBe('READY')
    expect(created.filename).toMatch(/^apc-dang-ky-evt-e6-.*\.csv$/)
    exportIds.push(created.id)

    // File xuất chỉ người tạo tải được (DATA-09, RP-17): manager Ban B tải → 404.
    expect((await get('managerB', `/portal/exports/${created.id}/download`)).statusCode).toBe(404)
    const download = await get('manager', `/portal/exports/${created.id}/download`)
    expect(download.statusCode).toBe(200)
    expect(download.headers['content-type']).toContain('text/csv')
    // BOM UTF-8 (\uFEFF) để Excel mở đúng tiếng Việt (E6_xong khi: mở bằng Excel hiển thị đúng tiếng Việt).
    expect(download.body.charCodeAt(0)).toBe(0xfeff)
    expect(download.body).toContain(`Nguyễn Thị Khách ${tag}`)
    // Nhãn tiếng Việt của cột Điểm danh — lúc xuất này chưa ai được đánh dấu nên cả danh sách Chưa điểm danh
    expect(download.body).toContain('Điểm danh')
    expect(download.body).toContain('Chưa điểm danh')

    // Xuất là thao tác nhạy cảm: một dòng audit cho mỗi lượt (docs/02 mục 11).
    const record = await db.auditLog.findFirst({
      where: { action: 'event.export', targetType: 'EXPORT_FILE', targetId: created.id },
    })
    expect(record).toMatchObject({ actorId: users.manager.id, result: 'SUCCESS' })
  })

  it('manager Ban A xuất sự kiện Ban B nhận 404, thành viên thường nhận 403', async () => {
    expect((await post('manager', `/admin/events/${eventB}/registrations/export`, {})).statusCode).toBe(404)
    expect((await post('memberA', `/admin/events/${eventA}/registrations/export`, {})).statusCode).toBe(403)
  })
})

// ─── PATCH /admin/events/:id/registrations/:registrationId/attendance ────────

describe('PATCH /admin/events/:id/registrations/:registrationId/attendance', () => {
  it('manager điểm danh từng người: lưu ngay, trả hàng đã cập nhật, ghi audit event.checkin', async () => {
    const response = await patchReq('manager', `/admin/events/${eventA}/registrations/${guestRegA}/attendance`, {
      attendanceStatus: 'PRESENT',
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(
      expect.objectContaining({ id: guestRegA, attendanceStatus: 'PRESENT', guestFullName: `Nguyễn Thị Khách ${tag}` }),
    )

    const stored = await db.eventRegistration.findUniqueOrThrow({ where: { id: guestRegA } })
    expect(stored.attendanceStatus).toBe('PRESENT')

    const record = await db.auditLog.findFirst({
      where: { action: 'event.checkin', targetType: 'EVENT_REGISTRATION', targetId: guestRegA },
    })
    expect(record).toMatchObject({ actorId: users.manager.id, result: 'SUCCESS' })

    // Trở lại Chưa điểm danh cũng là một bước đặt hợp lệ (người chưa đánh dấu giữ NOT_MARKED)
    const reset = await patchReq('manager', `/admin/events/${eventA}/registrations/${guestRegA}/attendance`, {
      attendanceStatus: 'NOT_MARKED',
    })
    expect(reset.statusCode).toBe(200)
    expect(reset.json().attendanceStatus).toBe('NOT_MARKED')
    await patchReq('manager', `/admin/events/${eventA}/registrations/${guestRegA}/attendance`, { attendanceStatus: 'PRESENT' })

    // Thành viên memberA cũng được điểm danh PRESENT — phục vụ test lịch sử hoạt động dưới đây
    const memberMark = await patchReq('manager', `/admin/events/${eventA}/registrations/${memberRegA}/attendance`, {
      attendanceStatus: 'PRESENT',
    })
    expect(memberMark.statusCode).toBe(200)
  })

  it('điểm danh đăng ký đã hủy nhận 409, sai trạng thái nhận 422', async () => {
    const cancelled = await patchReq('manager', `/admin/events/${eventA}/registrations/${cancelledRegA}/attendance`, {
      attendanceStatus: 'PRESENT',
    })
    expect(cancelled.statusCode).toBe(409)

    const invalid = await patchReq('manager', `/admin/events/${eventA}/registrations/${guestRegA}/attendance`, {
      attendanceStatus: 'LATE',
    })
    expect(invalid.statusCode).toBe(422)
    expect(invalid.json().error).toBe('validation')
  })

  it('manager Ban A mở đăng ký sự kiện Ban B nhận 404; đăng ký của sự kiện khác cũng 404', async () => {
    // requireScope chặn ở sự kiện :id — Ban B coi như không tồn tại (docs/02 mục 12)
    expect(
      (await patchReq('manager', `/admin/events/${eventB}/registrations/${memberRegB}/attendance`, { attendanceStatus: 'PRESENT' }))
        .statusCode,
    ).toBe(404)
    // Đăng ký của sự kiện khác nhưng sự kiện trên URL thuộc ban mình: service trả 404
    expect(
      (await patchReq('manager', `/admin/events/${eventA}/registrations/${memberRegB}/attendance`, { attendanceStatus: 'PRESENT' }))
        .statusCode,
    ).toBe(404)
  })
})

// ─── POST /admin/events/:id/attendance/finalize ──────────────────────────────

describe('POST /admin/events/:id/attendance/finalize', () => {
  it('manager chốt điểm danh: lưu thời điểm + người chốt, audit event.checkin targetType EVENT, chi tiết sự kiện hiện trạng thái', async () => {
    const response = await post('manager', `/admin/events/${eventA}/attendance/finalize`)
    expect(response.statusCode).toBe(200)
    const body = response.json() as { attendanceFinalizedAt: string; attendanceFinalizedBy: { id: string; fullName: string } }
    expect(body.attendanceFinalizedBy).toEqual({ id: users.manager.id, fullName: 'Người E6 manager' })

    const stored = await db.event.findUniqueOrThrow({ where: { id: eventA } })
    expect(stored.attendanceFinalizedAt).not.toBeNull()
    expect(stored.attendanceFinalizedById).toBe(users.manager.id)

    const record = await db.auditLog.findFirst({
      where: { action: 'event.checkin', targetType: 'EVENT', targetId: eventA },
    })
    expect(record).toMatchObject({ actorId: users.manager.id, result: 'SUCCESS' })

    // Trang chi tiết quản trị trả kèm trạng thái chốt để web khóa ô sửa
    const detail = await get('manager', `/admin/events/${eventA}`)
    expect(detail.statusCode).toBe(200)
    expect(detail.json()).toEqual(
      expect.objectContaining({
        attendanceFinalizedAt: expect.any(String),
        attendanceFinalizedBy: { id: users.manager.id, fullName: 'Người E6 manager' },
      }),
    )
  })

  it('chốt hai lần nhận 409; manager Ban A chốt sự kiện Ban B nhận 404; thành viên thường 403', async () => {
    expect((await post('manager', `/admin/events/${eventA}/attendance/finalize`)).statusCode).toBe(409)
    expect((await post('manager', `/admin/events/${eventB}/attendance/finalize`)).statusCode).toBe(404)
    expect((await post('memberA', `/admin/events/${eventA}/attendance/finalize`)).statusCode).toBe(403)
  })
})

// ─── SAU KHI CHỈ BOARD SỬA ĐƯỢC, KÈM LÝ DO (docs/02 mục 8.3) ────────────────

describe('sửa điểm danh sau khi chốt', () => {
  it('manager Ban A sửa nhận 403 kèm dòng audit FAILURE', async () => {
    const response = await patchReq('manager', `/admin/events/${eventA}/registrations/${guestRegA}/attendance`, {
      attendanceStatus: 'ABSENT',
      reason: 'Khách báo đổi lịch',
    })
    expect(response.statusCode).toBe(403)
    expect(response.json().error).toBe('forbidden')

    // Kết quả không đổi sau khi bị chặn
    const stored = await db.eventRegistration.findUniqueOrThrow({ where: { id: guestRegA } })
    expect(stored.attendanceStatus).toBe('PRESENT')

    const record = await db.auditLog.findFirst({
      where: { action: 'event.edit_checkin', targetType: 'EVENT_REGISTRATION', targetId: guestRegA, result: 'FAILURE' },
    })
    expect(record).toMatchObject({ actorId: users.manager.id })
  })

  it('board sửa không có lý do nhận 422 (thiếu hoặc chỉ toàn khoảng trắng)', async () => {
    const missing = await patchReq('board', `/admin/events/${eventA}/registrations/${guestRegA}/attendance`, {
      attendanceStatus: 'ABSENT',
    })
    expect(missing.statusCode).toBe(422)

    const blank = await patchReq('board', `/admin/events/${eventA}/registrations/${guestRegA}/attendance`, {
      attendanceStatus: 'ABSENT',
      reason: '   ',
    })
    expect(blank.statusCode).toBe(422)

    // Cả hai lượt bị chặn: kết quả vẫn giữ nguyên
    const stored = await db.eventRegistration.findUniqueOrThrow({ where: { id: guestRegA } })
    expect(stored.attendanceStatus).toBe('PRESENT')
  })

  it('board sửa kèm lý do: 200, lưu kết quả, audit event.edit_checkin lưu lý do', async () => {
    const response = await patchReq('board', `/admin/events/${eventA}/registrations/${guestRegA}/attendance`, {
      attendanceStatus: 'ABSENT',
      reason: 'Khách báo đổi lịch sau khi chốt',
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(expect.objectContaining({ id: guestRegA, attendanceStatus: 'ABSENT' }))

    const stored = await db.eventRegistration.findUniqueOrThrow({ where: { id: guestRegA } })
    expect(stored.attendanceStatus).toBe('ABSENT')

    const record = await db.auditLog.findFirst({
      where: { action: 'event.edit_checkin', targetType: 'EVENT_REGISTRATION', targetId: guestRegA, result: 'SUCCESS' },
    })
    expect(record).toMatchObject({
      actorId: users.board.id,
      reason: 'Khách báo đổi lịch sau khi chốt',
    })
  })

  it('manager vẫn xem được danh sách sau khi chốt (chỉ bị chặn sửa)', async () => {
    const response = await post('manager', `/admin/events/${eventA}/registrations/search`, {})
    expect(response.statusCode).toBe(200)
    expect((response.json().items as { id: string }[]).map((item) => item.id)).toContain(guestRegA)
  })
})

// ─── LỊCH SỬ HOẠT ĐỘNG THÀNH VIÊN (EVT-08, trang T3) ─────────────────────────

describe('đồng bộ lịch sử hoạt động', () => {
  it('buổi đã điểm danh hiện trong /portal/me/activity của thành viên', async () => {
    // memberA được điểm danh PRESENT trước khi chốt ở describe trên
    const response = await get('memberA', '/portal/me/activity')
    expect(response.statusCode).toBe(200)
    const items = response.json().items as { id: string; attendanceStatus: string; event: { id: string } }[]
    const mine = items.find((item) => item.id === memberRegA)
    expect(mine).toEqual(
      expect.objectContaining({ id: memberRegA, attendanceStatus: 'PRESENT', event: expect.objectContaining({ id: eventA }) }),
    )
  })

  it('khách được điểm danh không tạo hồ sơ thành viên — kết quả chỉ lưu trong sự kiện', async () => {
    const guestEmail = `guest-dd-${tag}@test.local`
    await patchReq('managerB', `/admin/events/${eventB}/registrations/${memberRegB}/attendance`, { attendanceStatus: 'EXCUSED' })
    const guest = await createRegistration(eventB, { fullName: 'Khách điểm danh', email: guestEmail })
    await patchReq('managerB', `/admin/events/${eventB}/registrations/${guest.id}/attendance`, { attendanceStatus: 'PRESENT' })

    // Không tạo hồ sơ thành viên cho khách (FLOW-16): không tài khoản nào mang email khách.
    expect(await db.user.findFirst({ where: { email: guestEmail } })).toBeNull()
    // Kết quả nằm trên dòng đăng ký khách, không có userId
    const stored = await db.eventRegistration.findUniqueOrThrow({ where: { id: guest.id } })
    expect(stored).toEqual(expect.objectContaining({ attendanceStatus: 'PRESENT', userId: null }))
  })
})

import type { FastifyRequest } from 'fastify'
import type { Prisma } from '../../db/generated/client.js'
import { z } from 'zod'

import { db } from '../../db/client.js'
import { notFound } from '../../lib/errors.js'
import { formatVnDateTime } from '../../lib/vnTime.js'
import { pageArgs, pageQuery, toPage } from '../../lib/pagination.js'
import { type AuthUser, hasRole } from '../auth/rbac.js'
import { createExport, type ExportsContext } from '../exports/service.js'

// ─── E6: DANH SÁCH ĐĂNG KÝ (FLOW-16 bước 1-2, EVT-06, PAGE-MGT-EVT-05) ──────────────────────
// Tách khỏi service.ts (E2-E5) theo quy ước "nghiệp vụ phụ tách file theo tên".
// Tìm kiếm theo tên/email gửi qua body POST — không đặt email trên URL vì URL bị ghi log (OPS-11),
// cùng cách làm của danh sách hồ sơ ứng tuyển (R5).

/** Số dòng tối đa của một file xuất danh sách đăng ký (như MAX_EXPORT_APPLICATIONS của R5). */
export const MAX_EXPORT_REGISTRATIONS = 5000

export const registrationsSearchSchema = pageQuery.extend({
  // Trạng thái ĐĂNG KÝ (REGISTERED/CANCELLED), khác trạng thái điểm danh — EVT-13 tách hai nhóm này
  status: z.enum(['REGISTERED', 'CANCELLED']).optional(),
  search: z.string().trim().min(1).max(100).optional(),
})

export type RegistrationsSearchInput = z.infer<typeof registrationsSearchSchema>

/** Bộ lọc dùng chung cho danh sách và xuất CSV: cùng bộ lọc trên màn hình phải cho cùng dữ liệu. */
function registrationsWhere(eventId: string, query: RegistrationsSearchInput): Prisma.EventRegistrationWhereInput {
  const where: Prisma.EventRegistrationWhereInput = { eventId }
  if (query.status) where.status = query.status
  if (query.search) {
    // Thành viên lấy tên/email từ User, khách từ cột guest* — tìm cả hai nơi (BR-09: chỉ quản lý sự kiện xem được).
    where.OR = [
      { user: { OR: [{ fullName: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }] } },
      { guestFullName: { contains: query.search, mode: 'insensitive' } },
      { guestEmail: { contains: query.search, mode: 'insensitive' } },
    ]
  }
  return where
}

/** Một dòng danh sách: tên/email/MSSV đã gỡ khỏi relation (thành viên từ User, khách từ cột guest*). */
const registrationListSelect = {
  id: true,
  status: true,
  attendanceStatus: true,
  registeredAt: true,
  cancelledAt: true,
  user: { select: { fullName: true, email: true, studentId: true } },
  guestFullName: true,
  guestEmail: true,
  guestStudentId: true,
} satisfies Prisma.EventRegistrationSelect

type RegistrationListRow = Prisma.EventRegistrationGetPayload<{ select: typeof registrationListSelect }>

function toRegistrationItem(row: RegistrationListRow) {
  const { user, ...registration } = row
  return {
    ...registration,
    attendeeType: user ? ('MEMBER' as const) : ('GUEST' as const),
    fullName: user?.fullName ?? row.guestFullName,
    email: user?.email ?? row.guestEmail,
    studentId: user?.studentId ?? row.guestStudentId,
  }
}

/**
 * Danh sách đăng ký của một sự kiện cho trang quản trị (E6, FLOW-16 bước 1). Phạm vi ban đã chặn ở
 * route qua requireScope (quản lý ban mở sự kiện ban khác nhận 404, docs/02 mục 12); BOARD thấy tất cả.
 * Không trả registrationCode — mã chỉ người đăng ký và tra cứu dùng, không lọt qua danh sách quản trị.
 */
export async function listEventRegistrations(eventId: string, rawInput: unknown) {
  const query = registrationsSearchSchema.parse(rawInput ?? {})

  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true } })
  if (!event) throw notFound('Không tìm thấy sự kiện.')

  const where = registrationsWhere(eventId, query)
  const [items, total] = await db.$transaction([
    db.eventRegistration.findMany({
      where,
      orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }],
      select: registrationListSelect,
      ...pageArgs(query),
    }),
    db.eventRegistration.count({ where }),
  ])
  return toPage(items.map(toRegistrationItem), total, query)
}

/** Nhãn tiếng Việt của trạng thái điểm danh cho cột CSV (EVT-13). */
export const ATTENDANCE_LABELS: Record<string, string> = {
  NOT_MARKED: 'Chưa điểm danh',
  PRESENT: 'Có mặt',
  EXCUSED: 'Vắng có phép',
  ABSENT: 'Vắng mặt',
}

const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  REGISTERED: 'Đã đăng ký',
  CANCELLED: 'Đã hủy',
}

/**
 * Xuất danh sách đăng ký ra CSV (E6, EVT-06, REC-11 cùng cách làm): dựng rows theo bộ lọc đang bật
 * trên màn hình rồi gọi `createExport(...)` của D6 — BOM UTF-8 để Excel mở đúng tiếng Việt, chống
 * chèn công thức, và audit `event.export` ghi sẵn bên trong createExport. File chỉ người tạo tải được
 * (downloaderId = người gọi, kiểm lại ở route tải D6; DATA-09, RP-17).
 */
export async function exportEventRegistrations(
  request: FastifyRequest,
  eventId: string,
  rawInput: unknown,
  user: AuthUser,
  context: ExportsContext,
) {
  const query = registrationsSearchSchema.parse(rawInput ?? {})
  // Route đã chặn bằng requireRole; dòng này để gọi trực tiếp service cũng phải có người đăng nhập.
  if (!hasRole(user, 'DEPARTMENT_MANAGER') && !hasRole(user, 'BOARD')) {
    throw notFound()
  }

  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, slug: true, title: true } })
  if (!event) throw notFound('Không tìm thấy sự kiện.')

  const registrations = await db.eventRegistration.findMany({
    where: registrationsWhere(eventId, query),
    orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }],
    take: MAX_EXPORT_REGISTRATIONS,
    select: registrationListSelect,
  })

  const rows: Record<string, unknown>[] = registrations.map((row) => {
    const item = toRegistrationItem(row)
    return {
      'Họ và tên': item.fullName ?? '',
      'Email': item.email ?? '',
      'MSSV': item.studentId ?? '',
      'Loại': item.attendeeType === 'MEMBER' ? 'Thành viên' : 'Khách',
      'Trạng thái đăng ký': REGISTRATION_STATUS_LABELS[row.status] ?? row.status,
      'Điểm danh': ATTENDANCE_LABELS[row.attendanceStatus] ?? row.attendanceStatus,
      'Thời gian đăng ký': formatVnDateTime(row.registeredAt),
      'Thời gian hủy': row.cancelledAt ? formatVnDateTime(row.cancelledAt) : '',
    }
  })

  return createExport(
    request,
    {
      kind: 'event',
      filename: `apc-dang-ky-${event.slug}.csv`,
      rows,
    },
    context,
  )
}

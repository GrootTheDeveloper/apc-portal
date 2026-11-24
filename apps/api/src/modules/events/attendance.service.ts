import type { FastifyRequest } from 'fastify'
import type { Prisma } from '../../db/generated/client.js'
import { z } from 'zod'

import { db } from '../../db/client.js'
import { AppError, conflict, forbidden, notFound } from '../../lib/errors.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult } from '../audit/service.js'
import { currentUser, hasRole } from '../auth/rbac.js'

// ─── E6: ĐIỂM DANH VÀ CHỐT ĐIỂM DANH (FLOW-16, EVT-07, EVT-08, PAGE-MGT-EVT-06) ─────────────
// Tách khỏi service.ts (E2-E5) theo quy ước "nghiệp vụ phụ tách file theo tên".
//
// Quyền theo docs/02 mục 8.3: điểm danh — DEPARTMENT_MANAGER (SCOPE) và BOARD (ALL); SAU khi chốt
// chỉ BOARD sửa được và bắt buộc lý do. Phạm vi ban chặn ở route qua requireScope (ngoài ban → 404).
// Mọi thao tác đều gọi audit: điểm danh/chốt dùng `event.checkin`, sửa sau chốt dùng `event.edit_checkin`.

/** Kết quả điểm danh theo EVT-13/FLOW-16: người chưa đánh dấu giữ NOT_MARKED. */
export const ATTENDANCE_STATUSES = ['NOT_MARKED', 'PRESENT', 'EXCUSED', 'ABSENT'] as const

export const attendanceUpdateSchema = z.object({
  attendanceStatus: z.enum(ATTENDANCE_STATUSES),
  // Chỉ bắt buộc khi sự kiện đã chốt (kiểm ở service vì phụ thuộc trạng thái sự kiện, không phải ô nhập)
  reason: z.string().trim().min(1).max(500).optional(),
})

/** Dữ liệu phụ thuộc database sai (thiếu lý do sau chốt): trả 422 dạng { error: 'validation' } như lỗi Zod. */
const invalidInput = (message: string) => new AppError(422, 'validation', message)

/** Trường trả về cho một dòng điểm danh: đủ để web cập nhật ngay hàng vừa bấm (không tải lại trang). */
const attendanceRowSelect = {
  id: true,
  status: true,
  attendanceStatus: true,
  user: { select: { fullName: true } },
  guestFullName: true,
} satisfies Prisma.EventRegistrationSelect

/**
 * Điểm danh từng người (FLOW-16 bước 3, EVT-07): lưu NGAY mỗi lượt bấm — web gửi một PATCH cho đúng
 * người đó, mất mạng chỉ ảnh hưởng lượt đang gửi, các lượt đã lưu giữ nguyên. Chưa chốt: cả quản lý
 * ban lẫn BOARD sửa được tự do; đăng ký đã hủy thì không điểm danh (409). Chưa đánh dấu giữ NOT_MARKED
 * (không có nút "xóa hết"), trả lại hàng đã cập nhật để web không phải gọi lại danh sách.
 */
export async function updateAttendance(
  request: FastifyRequest,
  eventId: string,
  registrationId: string,
  rawBody: unknown,
) {
  const user = currentUser(request)
  const input = attendanceUpdateSchema.parse(rawBody)

  return db.$transaction(async (tx) => {
    // Khóa dòng sự kiện: chốt điểm danh song song phải chờ, nên trạng thái "đã chốt" đọc dưới đây không cũ.
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { id: true, attendanceFinalizedAt: true },
    })
    if (!event) throw notFound('Không tìm thấy sự kiện.')

    // id đăng ký phải thuộc đúng sự kiện trên URL: đăng ký sự kiện khác coi như không tồn tại (docs/02 mục 12).
    const registration = await tx.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
      select: { id: true, status: true, attendanceStatus: true },
    })
    if (!registration) throw notFound('Không tìm thấy đăng ký.')
    if (registration.status === 'CANCELLED') throw conflict('Đăng ký này đã hủy, không điểm danh được.')

    const previousStatus = registration.attendanceStatus
    const mark = () =>
      tx.eventRegistration.update({
        where: { id: registration.id },
        data: { attendanceStatus: input.attendanceStatus },
        select: attendanceRowSelect,
      })

    if (event.attendanceFinalizedAt) {
      // Đã chốt: chỉ BOARD sửa được, bắt buộc lý do (docs/02 mục 8.3 — quản lý ban nhận 403).
      if (!hasRole(user, 'BOARD')) {
        await audit(request, {
          action: AUDIT_ACTIONS.EVENT_EDIT_CHECKIN,
          targetType: 'EVENT_REGISTRATION',
          targetId: registration.id,
          category: AuditCategory.BUSINESS,
          result: AuditResult.FAILURE,
          reason: 'Đã chốt điểm danh — quản lý ban không sửa được kết quả',
          metadata: { eventId, attempted: input.attendanceStatus },
        })
        throw forbidden('Đã chốt điểm danh, chỉ Ban Chủ nhiệm được sửa kết quả kèm lý do.')
      }
      if (!input.reason) {
        throw invalidInput('Sửa điểm danh sau khi chốt bắt buộc nhập lý do.')
      }
      // Sửa sau chốt: lý do là bắt buộc — lưu vào audit để truy vết ai đổi kết quả vì sao.
      const updated = await mark()
      await audit(
        request,
        {
          action: AUDIT_ACTIONS.EVENT_EDIT_CHECKIN,
          targetType: 'EVENT_REGISTRATION',
          targetId: registration.id,
          category: AuditCategory.BUSINESS,
          result: AuditResult.SUCCESS,
          reason: input.reason,
          metadata: { eventId, attendanceStatus: input.attendanceStatus, previousStatus },
        },
        tx,
      )
      return updated
    }

    const updated = await mark()
    await audit(
      request,
      {
        action: AUDIT_ACTIONS.EVENT_CHECKIN,
        targetType: 'EVENT_REGISTRATION',
        targetId: registration.id,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        metadata: { eventId, attendanceStatus: input.attendanceStatus, previousStatus },
      },
      tx,
    )
    return updated
  })
}

/**
 * Chốt điểm danh (FLOW-16 bước 4): đóng băng kết quả của cả sự kiện. Chốt hai lần trả 409; sau khi
 * chốt, sửa từng người chỉ BOARD làm được kèm lý do (xem `updateAttendance`). Kết quả thành viên có
 * tài khoản hiển thị luôn ở `/portal/me/activity` (EVT-08) vì điểm danh lưu trên dòng đăng ký gắn userId.
 */
export async function finalizeAttendance(request: FastifyRequest, eventId: string) {
  const user = currentUser(request)
  const finalizedAt = new Date()

  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { id: true, attendanceFinalizedAt: true },
    })
    if (!event) throw notFound('Không tìm thấy sự kiện.')
    if (event.attendanceFinalizedAt) throw conflict('Sự kiện này đã chốt điểm danh trước đó.')

    // updateMany kèm điều kiện chưa chốt: hai request chốt song song chỉ một thắng (BR-16 tinh thần).
    const result = await tx.event.updateMany({
      where: { id: eventId, attendanceFinalizedAt: null },
      data: { attendanceFinalizedAt: finalizedAt, attendanceFinalizedById: user.id },
    })
    if (result.count === 0) throw conflict('Sự kiện vừa được chốt điểm danh, hãy tải lại trang.')

    // Thống kê kèm audit: đếm theo kết quả điểm danh của đăng ký còn hiệu lực.
    const counts = await tx.eventRegistration.groupBy({
      by: ['attendanceStatus'],
      where: { eventId, status: 'REGISTERED' },
      _count: { _all: true },
    })
    const summary = Object.fromEntries(counts.map((row) => [row.attendanceStatus, row._count._all]))

    await audit(
      request,
      {
        action: AUDIT_ACTIONS.EVENT_CHECKIN,
        targetType: 'EVENT',
        targetId: eventId,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        metadata: { finalized: true, ...summary },
      },
      tx,
    )

    const finalizedBy = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, fullName: true } })
    return { attendanceFinalizedAt: finalizedAt, attendanceFinalizedBy: finalizedBy }
  })
}

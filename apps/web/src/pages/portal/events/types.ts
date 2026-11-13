// Kiểu dữ liệu cho trang Sự kiện của thành viên trong portal, khớp GET /portal/events và
// GET /portal/events/:id (E5). Trạng thái sự kiện dùng chung với trang công khai.

import type { EventStatus } from '../../events/types'

export type PortalEventAudience = 'PUBLIC' | 'CLUB' | 'DEPARTMENT'

export type PortalEventListItem = {
  id: string
  slug: string
  title: string
  coverImageUrl: string | null
  eventType: string
  status: EventStatus
  audience: PortalEventAudience
  departmentName: string | null
  startAt: string
  endAt: string
  location: string | null
  onlineUrl: string | null
  /** Đăng ký hiện có của chính người xem (tối đa một dòng nhờ ràng buộc duy nhất sự kiện + tài khoản). */
  myRegistrationStatus: 'REGISTERED' | 'CANCELLED' | null
}

export type PortalEventDetail = Omit<PortalEventListItem, 'myRegistrationStatus'> & {
  description: string
  contactPoint: string | null
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  capacity: number | null
  allowGuestRegistration: boolean
  cancelReason: string | null
  registeredCount: number
  myRegistration: { status: 'REGISTERED' | 'CANCELLED'; registeredAt: string; cancelledAt: string | null } | null
}

/** Phản hồi POST /portal/events/:id/registrations: đã đăng ký từ trước thì `alreadyRegistered = true`. */
export type MemberRegistrationResult = {
  status: 'REGISTERED'
  alreadyRegistered: boolean
  registeredAt: string
  cancelledAt: string | null
}

/** Phản hồi POST /portal/events/:id/registrations/cancel. */
export type MemberCancellationResult = {
  status: 'CANCELLED'
  cancelledAt: string
}

/**
 * Trạng thái nhận đăng ký với thành viên (BR-08): chỉ khi sự kiện PUBLISHED, chưa qua thời điểm diễn ra
 * và trong thời gian nhận đăng ký. Khác khách (E3) ở chỗ mọi sự kiện thành viên nhìn được đều đăng ký
 * được — `allowGuestRegistration` chỉ chặn khách ngoài APC (EVT-02), không áp dụng cho thành viên.
 */
export function memberRegistrationState(
  event: Pick<PortalEventDetail, 'status' | 'registrationOpensAt' | 'registrationClosesAt' | 'endAt'>,
): 'open' | 'not_open' | 'closed' | null {
  if (event.status !== 'PUBLISHED') return null
  // PUBLISHED đã qua thời điểm diễn ra (tác vụ event-end chưa kịp chuyển trạng thái): coi như đã kết thúc
  if (new Date(event.endAt).getTime() < Date.now()) return null
  const now = Date.now()
  if (event.registrationOpensAt && now < new Date(event.registrationOpensAt).getTime()) return 'not_open'
  if (event.registrationClosesAt && now > new Date(event.registrationClosesAt).getTime()) return 'closed'
  return 'open'
}

/**
 * Đăng ký còn hủy được không (BR-08): sự kiện vẫn công bố, chưa qua thời điểm diễn ra và còn trong
 * thời hạn hủy — dùng để ẩn nút Hủy đăng ký khi API đã chặn sẵn phía server.
 */
export function memberCancellationOpen(event: Pick<PortalEventDetail, 'status' | 'endAt' | 'registrationClosesAt'>): boolean {
  if (event.status !== 'PUBLISHED') return false
  const now = Date.now()
  if (now >= new Date(event.endAt).getTime()) return false
  return event.registrationClosesAt === null || now < new Date(event.registrationClosesAt).getTime()
}

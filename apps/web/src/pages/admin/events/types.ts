// Kiểu dữ liệu cho trang quản trị Sự kiện, khớp GET /admin/events, GET /admin/events/:id (E4).
// API trả cùng một dạng trường cho danh sách và chi tiết (adminEventSelect) — khác nhau chỉ ở chỗ
// chi tiết đảm bảo tìm thấy, danh sách là mảng phân trang { items, total, page, pageSize }.

import type { Page } from '../../../lib/api'

export type AdminEventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'ENDED' | 'ARCHIVED'

export type EventAudience = 'PUBLIC' | 'CLUB' | 'DEPARTMENT'

export type AdminEvent = {
  id: string
  slug: string
  title: string
  description: string
  coverImageUrl: string | null
  eventType: string
  status: AdminEventStatus
  audience: EventAudience
  /** Ban quản lý sự kiện — null là sự kiện toàn CLB, chỉ BOARD xem được (EVT-02) */
  departmentId: string | null
  department: { id: string; name: string; code: string } | null
  contactPoint: string | null
  createdBy: { id: string; fullName: string }
  location: string | null
  onlineUrl: string | null
  startAt: string
  endAt: string
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  /** null là không giới hạn */
  capacity: number | null
  allowGuestRegistration: boolean
  cancelReason: string | null
  /** Chốt điểm danh (E6): set thì chỉ BOARD sửa được kết quả, kèm lý do — web khóa ô theo hai trường này */
  attendanceFinalizedAt: string | null
  attendanceFinalizedBy: { id: string; fullName: string } | null
  createdAt: string
  updatedAt: string
  /** Số đăng ký còn hiệu lực (REGISTERED) — đếm sẵn ở API (FLOW-15) */
  registeredCount: number
}

export type AdminEventPage = Page<AdminEvent>

/** Nhãn trạng thái trên trang quản trị — DRAFT chỉ gặp ở /admin, khác các nhãn trang công khai. */
export const ADMIN_EVENT_STATUS_LABELS: Record<AdminEventStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Bản nháp', className: 'bg-soft text-muted' },
  PUBLISHED: { label: 'Đang công bố', className: 'bg-ink text-paper font-bold' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-apc-red-pale text-apc-red' },
  ENDED: { label: 'Đã kết thúc', className: 'bg-soft text-ink' },
  ARCHIVED: { label: 'Lưu trữ', className: 'bg-soft text-muted opacity-60' },
}

export const AUDIENCE_LABELS: Record<EventAudience, string> = {
  PUBLIC: 'Công khai',
  CLUB: 'Toàn CLB',
  DEPARTMENT: 'Nội bộ ban',
}

// ─── E6: đăng ký & điểm danh (FLOW-16) — khớp POST /admin/events/:id/registrations/search ──

export type EventRegistrationStatus = 'REGISTERED' | 'CANCELLED'

export type AttendanceStatus = 'NOT_MARKED' | 'PRESENT' | 'EXCUSED' | 'ABSENT'

export type EventRegistrationItem = {
  id: string
  status: EventRegistrationStatus
  attendanceStatus: AttendanceStatus
  registeredAt: string
  cancelledAt: string | null
  /** MEMBER lấy từ tài khoản, GUEST từ thông tin khách nhập lúc đăng ký (E3) */
  attendeeType: 'MEMBER' | 'GUEST'
  fullName: string | null
  email: string | null
  studentId: string | null
}

export type RegistrationSearchResult = Page<EventRegistrationItem>

export type ExportCreated = {
  id: string
  status: string
  filename: string
  expiresAt: string
}

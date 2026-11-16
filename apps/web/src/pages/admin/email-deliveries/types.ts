import type { Role } from '../../../lib/auth'

export type DeliveryStatus = 'PENDING' | 'SENDING' | 'RETRY' | 'SENT' | 'FAILED'

export type DeliveryItem = {
  id: string
  type: string
  /** TECH_ADMIN (quyền INCIDENT) không nhận trường này */
  recipient?: string
  status: DeliveryStatus
  attempts: number
  nextAttemptAt: string
  lastError: string | null
  createdAt: string
  updatedAt: string
  department: { id: string; name: string } | null
}

/** Nhãn trạng thái thống nhất (STATE-13). */
export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  PENDING: 'Chờ gửi',
  SENDING: 'Đang gửi',
  RETRY: 'Chờ thử lại',
  SENT: 'Đã gửi',
  FAILED: 'Gửi lỗi',
}

export const STATUSES = Object.keys(STATUS_LABEL) as DeliveryStatus[]

/** Tên mẫu email (khớp templates.ts của API); loại chưa có trong bảng thì hiện mã gốc. */
export const TYPE_LABEL: Record<string, string> = {
  EVENT_REGISTRATION_CONFIRMED: 'Xác nhận đăng ký sự kiện (khách)',
  EVENT_REGISTRATION_CANCELLED: 'Xác nhận hủy đăng ký (khách)',
  EVENT_REGISTRATION_CONFIRMED_MEMBER: 'Xác nhận đăng ký sự kiện (thành viên)',
  EVENT_REGISTRATION_CANCELLED_MEMBER: 'Xác nhận hủy đăng ký (thành viên)',
  EVENT_CANCELLED: 'Thông báo sự kiện bị hủy',
  APPLICATION_SUBMITTED: 'Xác nhận nộp đơn tuyển',
  APPLICATION_STATUS: 'Cập nhật trạng thái hồ sơ',
  TEST: 'Email thử',
}

export const typeLabel = (type: string) => TYPE_LABEL[type] ?? type

/** Mã sự cố + lý do của TECH_ADMIN (quyền INCIDENT); chỉ gửi trong body, không đặt trên URL. */
export type IncidentAccess = { incidentId: string; reason: string }

/** Vai trò xem được danh sách theo ban hoặc toàn bộ; ai không có thì chỉ là TECH_ADMIN, đi theo mã sự cố. */
export const VIEWER_ROLES: Role[] = ['DEPARTMENT_MANAGER', 'BOARD']

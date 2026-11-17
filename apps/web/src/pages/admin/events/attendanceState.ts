// Hàm thuần và nhãn dùng chung của trang Điểm danh (PAGE-MGT-EVT-06, FLOW-16) và cột điểm danh
// ở trang Danh sách đăng ký. Tách khỏi component để test vitest được như eventForm.ts (E4).

import type { AttendanceStatus } from './types'

/** Nhãn tiếng Việt của kết quả điểm danh (EVT-13) — trùng ATTENDANCE_LABELS phía API. */
export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  NOT_MARKED: 'Chưa điểm danh',
  PRESENT: 'Có mặt',
  EXCUSED: 'Vắng có phép',
  ABSENT: 'Vắng mặt',
}

/** Màu pill theo kết quả — khối màu đặc, không viền mảnh (DESIGN.md). */
export const ATTENDANCE_STYLES: Record<AttendanceStatus, string> = {
  NOT_MARKED: 'bg-soft text-muted',
  PRESENT: 'bg-emerald-600 text-paper font-bold',
  EXCUSED: 'bg-apc-gold text-ink font-bold',
  ABSENT: 'bg-apc-red text-paper font-bold',
}

/** Bốn nút điểm danh theo thứ tự FLOW-16 bước 3; người chưa đánh dấu giữ NOT_MARKED. */
export const ATTENDANCE_OPTIONS: AttendanceStatus[] = ['NOT_MARKED', 'PRESENT', 'EXCUSED', 'ABSENT']

export type AttendanceSummary = Record<AttendanceStatus, number>

/** Đếm nhanh từng kết quả để hiện tiến độ trên đầu trang; mảng rỗng trả bộ đếm 0. */
export function attendanceSummary(items: { attendanceStatus: AttendanceStatus }[]): AttendanceSummary {
  const summary: AttendanceSummary = { NOT_MARKED: 0, PRESENT: 0, EXCUSED: 0, ABSENT: 0 }
  for (const item of items) summary[item.attendanceStatus] += 1
  return summary
}

/**
 * Ai được sửa điểm danh lúc này (docs/02 mục 8.3): trước khi chốt cả quản lý ban lẫn BOARD;
 * SAU khi chốt chỉ BOARD (kèm lý do, hỏi ở hộp riêng) — quản lý ban chỉ còn xem.
 */
export function canEditAttendance(isBoard: boolean, finalized: boolean): boolean {
  return finalized ? isBoard : true
}

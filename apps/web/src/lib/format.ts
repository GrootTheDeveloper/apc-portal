// BR-14: database lưu UTC, giao diện luôn hiển thị giờ Việt Nam (kể cả khi máy người xem đặt múi giờ khác).
export const TIME_ZONE = 'Asia/Ho_Chi_Minh'

const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const timeFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
})

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** "2026-09-27T17:30:00Z" → "28/09/2026" */
export const formatDate = (value: string | Date) => dateFormat.format(new Date(value))

/** "2026-09-27T17:30:00Z" → "00:30 28/09/2026" */
export const formatDateTime = (value: string | Date) => dateTimeFormat.format(new Date(value))

/** "2026-09-27T17:30:00Z" → "00:30" */
export const formatTime = (value: string | Date) => timeFormat.format(new Date(value))

export type VnParts = { year: number; month: number; day: number; hour: number; minute: number }

/** Ngày giờ theo lịch Việt Nam dạng số, dùng khi cần so sánh ngày hoặc xếp vào lịch tháng. */
export function vnParts(value: string | Date): VnParts {
  const parts = partsFormat.formatToParts(new Date(value))
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  return { year: pick('year'), month: pick('month'), day: pick('day'), hour: pick('hour'), minute: pick('minute') }
}

/**
 * Đổi từ chuỗi ISO (UTC) từ DB sang dạng "YYYY-MM-DDTHH:mm" theo giờ Việt Nam (+07:00)
 * để gán vào thuộc tính value của <input type="datetime-local" />
 */
export function toVnDatetimeInput(value: string | Date | null | undefined): string {
  if (!value) return ''
  const p = vnParts(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/**
 * Đổi chuỗi "YYYY-MM-DDTHH:mm" người dùng nhập (giờ VN) sang chuỗi ISO UTC để gửi lên API
 */
export function fromVnDatetimeInput(value: string): string {
  if (!value) return ''
  return new Date(`${value}:00+07:00`).toISOString()
}
// BR-14: database lưu UTC, giao diện luôn hiển thị giờ Việt Nam (kể cả khi máy người xem đặt múi giờ khác).
const TIME_ZONE = 'Asia/Ho_Chi_Minh'

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

/** "2026-09-27T17:30:00Z" → "28/09/2026" */
export const formatDate = (value: string | Date) => dateFormat.format(new Date(value))

/** "2026-09-27T17:30:00Z" → "00:30 28/09/2026" */
export const formatDateTime = (value: string | Date) => dateTimeFormat.format(new Date(value))

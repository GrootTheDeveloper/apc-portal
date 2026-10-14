// BR-14: dữ liệu lưu UTC nhưng mọi ngày/giờ hiển thị và so sánh theo lịch Việt Nam,
// không phụ thuộc múi giờ trên máy người xem. Dùng chung cho card sự kiện và lịch tháng.
export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: VN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export type VnParts = { year: number; month: number; day: number; hour: number; minute: number }

/** Lấy các thành phần ngày giờ theo lịch Việt Nam. */
export function vnParts(value: string | Date): VnParts {
  const parts = partsFormatter.formatToParts(new Date(value))
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  return { year: pick('year'), month: pick('month'), day: pick('day'), hour: pick('hour'), minute: pick('minute') }
}

export const vnTodayParts = (): VnParts => vnParts(new Date())

/** "2026-10" từ một mốc thời gian bất kỳ (theo ngày Việt Nam). */
export function monthKeyOf(value: string | Date): string {
  const { year, month } = vnParts(value)
  return buildMonthKey(year, month)
}

export const currentMonthKey = (): string => monthKeyOf(new Date())

export function buildMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Đọc "2026-10"; trả null khi sai định dạng hoặc tháng ngoài 1–12 (dùng cho ?month=). */
export function parseMonthKey(key: string | null): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key ?? '')
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

export function addMonths(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key) ?? parseMonthKey(currentMonthKey())!
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return buildMonthKey(date.getUTCFullYear(), date.getUTCMonth() + 1)
}

/** "Tháng 10/2026" cho tiêu đề lịch. */
export function monthKeyLabel(key: string): string {
  const { year, month } = parseMonthKey(key)!
  return `Tháng ${month}/${year}`
}

/** "14:00" — chỉ giờ:phút theo giờ Việt Nam (dùng cho dòng meta trên card). */
export function formatVnTime(value: string | Date): string {
  const { hour, minute } = vnParts(value)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

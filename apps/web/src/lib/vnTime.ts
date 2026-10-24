// Tháng dạng "2026-10" cho ?month= và lưới lịch tháng. Ngày theo lịch Việt Nam (BR-14), xem vnParts trong format.ts.
import { vnParts, type VnParts } from './format'

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

export type CalendarCell = { day: number; inMonth: boolean }

/** 42 ô (6 hàng x 7 cột, bắt đầu từ thứ Hai) của lưới tháng; ô ngoài tháng là ngày của tháng trước/sau. */
export function calendarCells(year: number, month: number): CalendarCell[] {
  // Thứ của ngày mùng 1 là thông tin lịch, không phụ thuộc múi giờ.
  const firstWeekdayMon0 = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const daysInPrevMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate()
  return Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - firstWeekdayMon0 + 1
    if (dayNumber < 1) return { day: daysInPrevMonth + dayNumber, inMonth: false }
    if (dayNumber > daysInMonth) return { day: dayNumber - daysInMonth, inMonth: false }
    return { day: dayNumber, inMonth: true }
  })
}

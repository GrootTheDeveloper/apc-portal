import { Link } from 'react-router-dom'

import type { EventListItem } from '../mock'
import { formatVnTime, monthKeyLabel, addMonths, parseMonthKey, vnParts, vnTodayParts } from '../../../lib/vnTime'

// Class màu để literal (không nội suy) để Tailwind JIT nhận diện được.
const STATUS_CHIP: Record<EventListItem['status'], string> = {
  PUBLISHED: 'bg-apc-blue/10 text-apc-blue hover:bg-apc-blue/20',
  CANCELLED: 'bg-apc-red/10 text-apc-red line-through hover:bg-apc-red/20',
  ENDED: 'bg-on-surface-variant/10 text-on-surface-variant hover:bg-on-surface-variant/20',
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const MAX_CHIPS_PER_DAY = 2

type EventCalendarProps = {
  monthKey: string
  events: EventListItem[]
  onMonthChange: (monthKey: string) => void
}

/**
 * Lưới tháng tự dựng bằng CSS grid (PUB-04), không dùng thư viện lịch.
 * Mỗi ngày liệt kê tên sự kiện theo ngày Việt Nam (BR-14); đổi tháng do trang cha ghi lên URL (?month=).
 */
export function EventCalendar({ monthKey, events, onMonthChange }: EventCalendarProps) {
  const parsed = parseMonthKey(monthKey)
  if (!parsed) return null
  const { year, month } = parsed

  // 00:00 giờ VN của ngày 1 = 17:00 UTC của ngày cuối tháng trước (VN = UTC+7, không có DST).
  const firstWeekdayMon0 = (new Date(Date.UTC(year, month - 1, 1, 0, 0) - 7 * 3_600_000).getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const daysInPrevMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate()

  const eventsByDay = new Map<number, EventListItem[]>()
  for (const event of events) {
    const { year: eventYear, month: eventMonth, day } = vnParts(event.startAt)
    if (eventYear !== year || eventMonth !== month) continue
    const bucket = eventsByDay.get(day)
    if (bucket) bucket.push(event)
    else eventsByDay.set(day, [event])
  }

  const today = vnTodayParts()
  const isThisMonth = today.year === year && today.month === month

  // Luôn 6 hàng x 7 ô để lịch không nhảy chiều cao giữa các tháng.
  const cells = Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - firstWeekdayMon0 + 1
    if (dayNumber < 1) return { day: daysInPrevMonth + dayNumber, inMonth: false }
    if (dayNumber > daysInMonth) return { day: dayNumber - daysInMonth, inMonth: false }
    return { day: dayNumber, inMonth: true }
  })

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          type="button"
          aria-label="Tháng trước"
          onClick={() => onMonthChange(addMonths(monthKey, -1))}
          className="inline-flex items-center gap-1 rounded-apc border border-outline-variant/40 px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined text-base">chevron_left</span> Tháng trước
        </button>
        <h2 className="font-bold text-lg text-on-surface">{monthKeyLabel(monthKey)}</h2>
        <button
          type="button"
          aria-label="Tháng sau"
          onClick={() => onMonthChange(addMonths(monthKey, 1))}
          className="inline-flex items-center gap-1 rounded-apc border border-outline-variant/40 px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors"
        >
          Tháng sau <span className="material-symbols-outlined text-base">chevron_right</span>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={monthKeyLabel(monthKey)}>
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="pb-1 text-center text-xs font-bold uppercase text-on-surface-variant" role="columnheader">
            {weekday}
          </div>
        ))}
        {cells.map((cell, index) => {
          const dayEvents = cell.inMonth ? (eventsByDay.get(cell.day) ?? []) : []
          const isToday = isThisMonth && cell.inMonth && today.day === cell.day
          return (
            <div
              key={index}
              className={`rounded-lg border p-1.5 min-h-20 flex flex-col gap-1 ${
                cell.inMonth ? 'border-outline-variant/20 bg-white' : 'border-outline-variant/10 bg-surface-container-low'
              } ${isToday ? 'border-apc-red' : ''}`}
            >
              <span className={`text-xs font-bold ${cell.inMonth ? 'text-on-surface' : 'text-on-surface-variant/50'} ${isToday ? 'text-apc-red' : ''}`}>
                {cell.day}
              </span>
              {dayEvents.slice(0, MAX_CHIPS_PER_DAY).map((event) => (
                <Link
                  key={event.slug}
                  to={`/events/${event.slug}`}
                  title={event.title}
                  className={`block rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-tight truncate transition-colors ${STATUS_CHIP[event.status]}`}
                >
                  {formatVnTime(event.startAt)} {event.title}
                </Link>
              ))}
              {dayEvents.length > MAX_CHIPS_PER_DAY && (
                <span className="text-[10px] text-on-surface-variant">+{dayEvents.length - MAX_CHIPS_PER_DAY} nữa</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'

import { buttonClass } from '../../../components/buttonClass'
import type { EventListItem } from '../types'
import { formatTime, vnParts } from '../../../lib/format'
import { addMonths, calendarCells, monthKeyLabel, parseMonthKey, vnTodayParts } from '../../../lib/vnTime'

// Class màu để literal (không nội suy) để Tailwind JIT nhận diện được.
const STATUS_CHIP: Record<EventListItem['status'], string> = {
  PUBLISHED: 'bg-apc-blue text-paper hover:bg-apc-blue-deep',
  CANCELLED: 'bg-apc-red/10 text-apc-red line-through hover:bg-apc-red/20',
  ENDED: 'bg-ink/10 text-ink/70 hover:bg-ink/15',
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
  const cells = calendarCells(year, month)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-[clamp(28px,3vw,40px)] font-extrabold capitalize leading-none tracking-[-0.02em]">
          {monthKeyLabel(monthKey)}
        </h2>
        <div className="flex gap-3">
          <button type="button" onClick={() => onMonthChange(addMonths(monthKey, -1))} className={buttonClass('outline', 'px-5')}>
            ← Tháng trước
          </button>
          <button type="button" onClick={() => onMonthChange(addMonths(monthKey, 1))} className={buttonClass('outline', 'px-5')}>
            Tháng sau →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label={monthKeyLabel(monthKey)}>
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="pb-1 text-center font-code text-[13px] font-bold text-muted" role="columnheader">
            {weekday}
          </div>
        ))}
        {cells.map((cell, index) => {
          const dayEvents = cell.inMonth ? (eventsByDay.get(cell.day) ?? []) : []
          const isToday = isThisMonth && cell.inMonth && today.day === cell.day
          return (
            <div
              key={index}
              className={`flex min-h-24 flex-col gap-1 rounded-xl p-1.5 md:p-2 ${cell.inMonth ? 'bg-soft' : ''} ${
                isToday ? 'shadow-[inset_0_0_0_2px_#C23B22]' : ''
              }`}
            >
              <span className={`font-code text-[13px] font-bold ${cell.inMonth ? '' : 'text-ink/30'} ${isToday ? 'text-apc-red' : ''}`}>
                {cell.day}
              </span>
              {dayEvents.slice(0, MAX_CHIPS_PER_DAY).map((event) => (
                <Link
                  key={event.slug}
                  to={`/events/${event.slug}`}
                  title={event.title}
                  className={`block truncate rounded-md px-1.5 py-0.5 text-[11px] font-bold leading-tight transition-colors ${STATUS_CHIP[event.status]}`}
                >
                  {formatTime(event.startAt)} {event.title}
                </Link>
              ))}
              {dayEvents.length > MAX_CHIPS_PER_DAY && (
                <span className="font-code text-[11px] font-bold text-muted">+{dayEvents.length - MAX_CHIPS_PER_DAY} nữa</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

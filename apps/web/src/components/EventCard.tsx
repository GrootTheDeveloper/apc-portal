import { Link } from 'react-router-dom'

import { EVENT_STATUS_STYLES, eventTypeVisual, type EventCardStatus } from '../lib/eventVisual'
import { formatDate } from '../lib/format'
import { VN_TIME_ZONE, formatVnTime, vnParts } from '../lib/vnTime'

const monthFormatter = new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TIME_ZONE, month: 'short' })

type EventCardProps = {
  slug: string
  title: string
  eventType: string
  startAt: string
  endAt: string
  location?: string | null
  onlineUrl?: string | null
  /** Truyền để hiện nhãn trạng thái (trang sự kiện); bỏ qua trên trang chủ để giữ nguyên giao diện cũ. */
  status?: EventCardStatus
  /** Gắn ngữ cảnh danh sách để nút về từ chi tiết giữ nguyên bộ lọc (Sitemap §15.3). */
  linkState?: { from: string }
}

/** Card sự kiện dùng chung: trang chủ và trang /events đều render từ dữ liệu. */
export function EventCard({ slug, title, eventType, startAt, endAt, location, onlineUrl, status, linkState }: EventCardProps) {
  const style = eventTypeVisual(eventType)
  const badge = vnParts(startAt)
  const start = vnParts(startAt)
  const end = vnParts(endAt)
  const sameDay = start.year === end.year && start.month === end.month && start.day === end.day
  const timeText = sameDay
    ? `${formatVnTime(startAt)} - ${formatVnTime(endAt)}`
    : `${formatDate(startAt)} - ${formatDate(endAt)}`
  const statusStyle = status ? EVENT_STATUS_STYLES[status] : undefined

  return (
    <Link
      to={`/events/${slug}`}
      state={linkState}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-outline-variant/20 flex flex-col hover:shadow-md hover:-translate-y-1 transition-all duration-300"
    >
      <div className={`relative aspect-[16/10] flex items-center justify-center bg-gradient-to-br ${style.coverClass}`}>
        <span className={`material-symbols-outlined text-5xl ${style.iconClass} ${statusStyle && status !== 'PUBLISHED' ? 'opacity-60 grayscale' : ''}`}>
          {style.icon}
        </span>
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-lg px-2.5 py-1 flex flex-col items-center leading-none">
          <span className="text-apc-red font-bold text-lg">{badge.day}</span>
          <span className="text-on-surface-variant text-[9px] uppercase font-bold">{monthFormatter.format(new Date(startAt))}</span>
        </div>
        {statusStyle && (
          <span className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle.chipClass}`}>
            {statusStyle.label}
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col gap-2 flex-1">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold w-max ${style.chipClass}`}>{eventType}</span>
        <h3 className="font-bold text-base text-on-surface leading-tight group-hover:text-apc-blue transition-colors line-clamp-2">
          {title}
        </h3>
        <div className="mt-auto pt-1 flex flex-col gap-1">
          <div className="flex items-center gap-1 text-on-surface-variant text-xs">
            <span className="material-symbols-outlined text-sm">schedule</span> {timeText}
          </div>
          {(location || onlineUrl) && (
            <div className="flex items-center gap-1 text-on-surface-variant text-xs">
              <span className="material-symbols-outlined text-sm">{location ? 'location_on' : 'videocam'}</span>
              <span className="truncate">{location ?? 'Trực tuyến'}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

import { Link } from 'react-router-dom'

import { EVENT_STATUS_STYLES, eventPhoto, type EventCardStatus } from '../lib/eventVisual'
import { formatDate, formatTime, vnParts } from '../lib/format'

type EventCardProps = {
  slug: string
  title: string
  eventType: string
  startAt: string
  endAt: string
  location?: string | null
  onlineUrl?: string | null
  coverImageUrl?: string | null
  /** Truyền để hiện nhãn khi sự kiện đã hủy hoặc đã kết thúc. */
  status?: EventCardStatus
  /** Gắn ngữ cảnh danh sách để nút về từ chi tiết giữ nguyên bộ lọc (Sitemap §15.3). */
  linkState?: { from: string }
}

/** Card sự kiện: ảnh bo góc có ô ngày, bên dưới là loại, tên và giờ. */
export function EventCard({ slug, title, eventType, startAt, endAt, location, onlineUrl, coverImageUrl, status, linkState }: EventCardProps) {
  const start = vnParts(startAt)
  const end = vnParts(endAt)
  const sameDay = start.year === end.year && start.month === end.month && start.day === end.day
  const timeText = sameDay ? `${formatTime(startAt)} – ${formatTime(endAt)}` : `${formatDate(startAt)} – ${formatDate(endAt)}`
  // Sự kiện sắp diễn ra không cần nhãn, ô ngày đã nói đủ.
  const statusStyle = status && status !== 'PUBLISHED' ? EVENT_STATUS_STYLES[status] : undefined

  return (
    <Link to={`/events/${slug}`} state={linkState} className="group flex min-w-0 flex-col">
      <div className="photo relative aspect-[4/3] bg-soft">
        <img
          alt=""
          className={`h-full ${statusStyle ? 'opacity-60 grayscale' : ''}`}
          loading="lazy"
          src={eventPhoto(eventType, coverImageUrl)}
        />
        <span className="absolute left-3 top-3 flex flex-col items-center rounded-xl bg-paper px-3 pb-1.5 pt-2 text-ink">
          <b className="font-display text-[30px] font-extrabold leading-[0.85]">{String(start.day).padStart(2, '0')}</b>
          <span className="mt-1 font-code text-[12px] font-bold">th{start.month}</span>
        </span>
        {statusStyle && (
          <span className={`absolute right-3 top-3 rounded-md px-2 py-1 font-code text-[12px] font-bold ${statusStyle.chipClass}`}>
            {statusStyle.label}
          </span>
        )}
      </div>
      <p className="mt-4 font-code text-[13px] font-bold text-apc-blue">{eventType}</p>
      <h3 className="mt-1 line-clamp-2 font-display text-[22px] font-bold leading-[1.15] transition-colors group-hover:text-apc-red">
        {title}
      </h3>
      <p className="mt-2 text-[15px] text-muted">
        <b className="text-ink">{timeText}</b>
        {(location || onlineUrl) && ` · ${location ?? 'Trực tuyến'}`}
      </p>
    </Link>
  )
}

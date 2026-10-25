import type { CSSProperties, MouseEvent } from 'react'
import { Link } from 'react-router-dom'

import { eventPhoto } from '../../../lib/eventVisual'
import { formatDateTime, formatTime, vnParts } from '../../../lib/format'
import { homeEvents } from '../../events/mock'
import { Eyebrow } from '../../../components/Eyebrow'

// Màu quét ngang khi rê vào từng hàng, xoay vòng theo bộ ba màu logo (gold thay bằng xanh than để chữ trắng đọc rõ).
const SWEEPS = ['#C23B22', '#1568C9', '#081F3D']
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** Ảnh minh hoạ của hàng đi theo con trỏ chuột (CSS đọc --mx, --my). */
function followPointer(event: MouseEvent<HTMLElement>) {
  const row = event.currentTarget
  const rect = row.getBoundingClientRect()
  row.style.setProperty('--mx', `${event.clientX - rect.left}px`)
  row.style.setProperty('--my', `${event.clientY - rect.top}px`)
}

export function EventsSection() {
  const events = homeEvents()

  return (
    <section className="screen flex items-center bg-paper px-4 py-[clamp(40px,8vh,96px)] md:px-8">
      <div className="mx-auto w-full max-w-container-max">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow data-rv className="text-apc-blue">
              lịch sắp tới
            </Eyebrow>
            <h2
              data-rv
              className="mt-3 font-display text-[clamp(40px,min(4.8vw,8vh),76px)] font-extrabold leading-[0.95] tracking-[-0.03em] text-apc-red"
              style={{ '--d': '60ms' } as CSSProperties}
            >
              Sắp diễn ra ở APC
            </h2>
          </div>
          <Link
            data-rv
            className="inline-flex min-h-12 items-center text-[17px] font-extrabold text-apc-red underline decoration-2 underline-offset-4 hover:text-apc-red-deep"
            to="/events"
          >
            Xem tất cả sự kiện →
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="mt-10 text-[18px]">Chưa có sự kiện sắp diễn ra. Ghé lại sau hoặc xem lịch trên trang Sự kiện nha.</p>
        ) : (
          <ul className="mt-[clamp(20px,4.5vh,48px)] border-t-2 border-ink">
            {events.map((event, index) => {
              const start = vnParts(event.startAt)
              const end = vnParts(event.endAt)
              const weekday = WEEKDAYS[new Date(Date.UTC(start.year, start.month - 1, start.day)).getUTCDay()]
              // Sự kiện kéo qua ngày khác (hackathon) thì ghi cả ngày.
              const when =
                start.day === end.day && start.month === end.month && start.year === end.year
                  ? `${formatTime(event.startAt)} – ${formatTime(event.endAt)}`
                  : `${formatDateTime(event.startAt)} – ${formatDateTime(event.endAt)}`
              return (
                <li
                  key={event.slug}
                  data-rv
                  className="border-b-2 border-ink"
                  style={{ '--d': `${120 + index * 90}ms`, '--sweep': SWEEPS[index % SWEEPS.length] } as CSSProperties}
                >
                  <Link
                    className="agenda-row grid grid-cols-[84px_1fr] items-center gap-x-5 gap-y-1 px-2 py-6 md:grid-cols-[130px_1fr_minmax(0,300px)_48px] md:px-4 lg:py-[clamp(10px,2.2vh,28px)]"
                    onMouseMove={followPointer}
                    to={`/events/${event.slug}`}
                  >
                    <span className="agenda-ink row-span-2 md:row-span-1">
                      <span className="block font-display text-[clamp(44px,min(5vw,7.5vh),72px)] font-extrabold leading-[0.85]">
                        {String(start.day).padStart(2, '0')}
                      </span>
                      <span className="mt-1 block font-code text-[14px] font-bold">
                        th{start.month} · {weekday}
                      </span>
                    </span>
                    <span className="agenda-ink">
                      <span className="block font-code text-[14px] font-bold opacity-75">{event.eventType}</span>
                      <span className="mt-1 block font-display text-[clamp(21px,2vw,30px)] font-bold leading-[1.15]">
                        {event.title}
                      </span>
                    </span>
                    <span className="agenda-ink text-[16px] max-md:col-start-2">
                      <b className="block">{when}</b>
                      {event.location ?? 'Trực tuyến'}
                    </span>
                    <span aria-hidden className="agenda-ink agenda-arrow text-[28px] font-extrabold max-md:hidden">
                      →
                    </span>
                    <img
                      alt=""
                      aria-hidden
                      className="agenda-photo pointer-events-none absolute z-10 hidden aspect-[3/2] w-[240px] rounded-2xl object-cover lg:block"
                      loading="lazy"
                      src={eventPhoto(event.eventType, event.coverImageUrl)}
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

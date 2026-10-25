import { Link } from 'react-router-dom'

import { EventCard } from '../../../components/EventCard'
import { Eyebrow } from '../../../components/Eyebrow'
import { homeEvents } from '../../events/mock'

export function EventsSection() {
  return (
    <section className="w-full min-h-0 py-section-padding px-gutter bg-white">
      <div className="max-w-container-max mx-auto fade-up w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-outline-variant/20 pb-6">
          <div>
            <Eyebrow className="text-on-surface-variant mb-2">LỊCH TRÌNH</Eyebrow>
            <h2 className="font-display-lg text-[32px] font-bold text-on-surface">Sự kiện sắp tới</h2>
          </div>
          <Link
            to="/events"
            className="text-apc-blue font-medium flex items-center gap-1 hover:underline text-sm mt-4 md:mt-0"
          >
            Xem tất cả sự kiện <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Không truyền status để trang chủ giữ nguyên giao diện cũ (không có nhãn trạng thái). */}
          {homeEvents().map((event) => (
            <EventCard key={event.slug} {...event} status={undefined} />
          ))}
        </div>
      </div>
    </section>
  )
}

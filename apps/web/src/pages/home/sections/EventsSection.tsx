import { Eyebrow } from './Eyebrow'

// Class màu để literal (không nội suy) để Tailwind JIT nhận diện được.
const EVENTS = [
  {
    category: 'Workshop',
    chipClass: 'bg-apc-blue/10 text-apc-blue',
    cover: 'from-apc-blue/15 to-surface-container-high',
    iconClass: 'text-apc-blue/50',
    icon: 'code',
    day: '15',
    month: 'THG 11',
    title: 'Clean Code & Design Pattern cơ bản',
    meta: { icon: 'schedule', text: '14:00 - 17:00' },
  },
  {
    category: 'Cuộc thi',
    chipClass: 'bg-apc-red/10 text-apc-red',
    cover: 'from-apc-red/15 to-surface-container-high',
    iconClass: 'text-apc-red/50',
    icon: 'emoji_events',
    day: '22',
    month: 'THG 11',
    title: 'APC Algorithmic Challenge #4',
    meta: { icon: 'location_on', text: 'Lab Công Nghệ UMT' },
  },
  {
    category: 'Tech Talk',
    chipClass: 'bg-apc-gold/10 text-apc-gold',
    cover: 'from-apc-gold/20 to-surface-container-high',
    iconClass: 'text-apc-gold/60',
    icon: 'campaign',
    day: '05',
    month: 'THG 12',
    title: 'Tương lai của AI trong lập trình phần mềm',
    meta: { icon: 'location_on', text: 'Hội trường A' },
  },
  {
    category: 'Hackathon',
    chipClass: 'bg-apc-blue/10 text-apc-blue',
    cover: 'from-apc-blue/15 to-surface-container-high',
    iconClass: 'text-apc-blue/50',
    icon: 'bolt',
    day: '14',
    month: 'THG 12',
    title: 'APC Mini Hackathon — Build in 24h',
    meta: { icon: 'group', text: 'Đội 3-4 thành viên' },
  },
]

export function EventsSection() {
  return (
    <section className="w-full min-h-0 py-section-padding px-gutter bg-white">
      <div className="max-w-container-max mx-auto fade-up w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-outline-variant/20 pb-6">
          <div>
            <Eyebrow className="text-on-surface-variant mb-2">LỊCH TRÌNH</Eyebrow>
            <h2 className="font-display-lg text-[32px] font-bold text-on-surface">Sự kiện sắp tới</h2>
          </div>
          <a className="text-apc-blue font-medium flex items-center gap-1 hover:underline text-sm mt-4 md:mt-0" href="#">
            Xem tất cả sự kiện <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {EVENTS.map((event) => (
            <article
              key={event.title}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-outline-variant/20 flex flex-col hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div className={`relative aspect-[16/10] flex items-center justify-center bg-gradient-to-br ${event.cover}`}>
                <span className={`material-symbols-outlined text-5xl ${event.iconClass}`}>{event.icon}</span>
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-lg px-2.5 py-1 flex flex-col items-center leading-none">
                  <span className="text-apc-red font-bold text-lg">{event.day}</span>
                  <span className="text-on-surface-variant text-[9px] uppercase font-bold">{event.month}</span>
                </div>
              </div>
              <div className="p-5 flex flex-col gap-2 flex-1">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold w-max ${event.chipClass}`}>
                  {event.category}
                </span>
                <h3 className="font-bold text-base text-on-surface leading-tight group-hover:text-apc-blue transition-colors line-clamp-2">
                  {event.title}
                </h3>
                <div className="flex items-center gap-1 text-on-surface-variant text-xs mt-auto pt-1">
                  <span className="material-symbols-outlined text-sm">{event.meta.icon}</span> {event.meta.text}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

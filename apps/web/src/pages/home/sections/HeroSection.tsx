import { Button } from './Button'

// chip: class màu literal cho ô icon (không nội suy) để Tailwind JIT nhận diện.
const HERO_POINTS = [
  { icon: 'school', label: 'Học qua dự án', chip: 'bg-apc-red/10 text-apc-red' },
  { icon: 'build', label: 'Xây dựng sản phẩm', chip: 'bg-apc-blue/10 text-apc-blue' },
  { icon: 'group', label: 'Kết nối workshop/contest', chip: 'bg-apc-gold/10 text-apc-gold' },
]

// Chỉ số mẫu — chờ APC xác nhận số liệu thật.
const CLUB_STATS = [
  { value: '20+', label: 'Dự án' },
  { value: '100+', label: 'Thành viên' },
  { value: '3', label: 'Ban chuyên môn' },
  { value: '15+', label: 'Sự kiện/năm' },
]

export function HeroSection() {
  return (
    <section className="relative w-full lg:min-h-[calc(100vh-4.5rem)] lg:grid lg:grid-cols-2 lg:grid-rows-1 bg-surface-container-lowest overflow-hidden">
      {/* Thanh gradient dọc bên trái */}
      <div
        aria-hidden
        className="absolute left-0 top-0 h-full w-[8px] z-20 bg-gradient-to-b from-apc-red via-apc-gold to-apc-blue"
      />
      {/* Cột trái: nội dung */}
      <div className="fade-up flex flex-col justify-center gap-6 px-gutter py-16 lg:pl-16 lg:pr-12 xl:pl-24">
        {/* Logo + vạch ngăn + nhãn */}
        <div className="flex items-center gap-4">
          <img alt="APC Logo" className="h-10 w-auto object-contain" src="/assets/home/00-apc-logo.png" />
          <div aria-hidden className="h-9 w-px bg-outline-variant" />
          <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant leading-tight">
            Câu lạc bộ Lập trình Ứng dụng
            <br />
            Khoa Công Nghệ · UMT
          </div>
        </div>

        {/* Tiêu đề 2 màu */}
        <h1 className="font-display-lg text-[44px] xl:text-[52px] leading-[1.1] font-bold tracking-tight">
          <span className="text-apc-dark">Từ ý tưởng đến</span>
          <br />
          <span className="text-apc-red">sản phẩm thật.</span>
        </h1>

        {/* Các dòng feature có chip icon màu */}
        <ul className="flex flex-col gap-4 mt-1">
          {HERO_POINTS.map((point) => (
            <li key={point.label} className="flex items-center gap-3">
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${point.chip}`}>
                <span className="material-symbols-outlined text-[20px]">{point.icon}</span>
              </span>
              <span className="font-medium text-on-surface">{point.label}</span>
            </li>
          ))}
        </ul>

        {/* CTA phát sáng + link phụ */}
        <div className="flex flex-wrap items-center gap-5 mt-4">
          <Button
            variant="primary"
            className="px-9 py-3.5 shadow-lg shadow-apc-red/30 hover:shadow-xl hover:shadow-apc-red/40"
          >
            Khám phá APC
          </Button>
          <a
            className="inline-flex items-center gap-1 font-medium text-apc-blue hover:gap-2 transition-all"
            href="#"
          >
            Xem hoạt động nổi bật <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </a>
        </div>
      </div>

      {/* Cột phải: ảnh full-bleed chiếm trọn nửa phải */}
      <div className="relative min-h-[45vh] lg:min-h-0">
        <img
          alt="Sinh viên APC đang làm việc"
          className="absolute inset-0 h-full w-full object-cover"
          src="/assets/home/02-apc-students-working.png"
        />
        {/* Scrim làm tối ảnh, đậm hơn ở đáy để đọc rõ chỉ số */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
        {/* 4 chỉ số CLB dưới đáy ảnh */}
        <div className="absolute inset-x-0 bottom-0 p-5 lg:p-6">
          <div className="grid grid-cols-4 gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-4">
            {CLUB_STATS.map((stat, index) => (
              <div
                key={stat.label}
                className={`flex flex-col items-center text-center ${index > 0 ? 'border-l border-white/15' : ''}`}
              >
                <span className="text-white font-bold text-xl lg:text-2xl leading-none">{stat.value}</span>
                <span className="text-white/70 text-[11px] mt-1 leading-tight">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

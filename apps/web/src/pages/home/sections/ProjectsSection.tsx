import { Button } from './Button'
import { Eyebrow } from './Eyebrow'

const UMTOJ_TAGS = ['React', 'Node.js', 'Docker']

export function ProjectsSection() {
  return (
    <section className="w-full justify-start pt-24 pb-16 px-gutter bg-white text-on-surface">
      <div className="max-w-container-max mx-auto fade-up w-full">
        <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <Eyebrow className="text-apc-blue mb-3">SẢN PHẨM</Eyebrow>
            <h2 className="font-headline-md text-3xl md:text-4xl font-bold text-on-surface">
              Sản phẩm được xây để sử dụng.
            </h2>
          </div>
          <a className="text-apc-blue font-medium flex items-center gap-1 hover:underline text-sm" href="#">
            Xem tất cả dự án <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* UMTOJ — card nổi bật, ảnh trái / nội dung phải */}
          <article className="lg:col-span-8 bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col md:flex-row">
            <div className="md:w-[45%] overflow-hidden">
              <img
                alt="UMT Online Judge"
                className="w-full h-56 md:h-full object-cover"
                src="/assets/home/06-umt-online-judge.jpg"
              />
            </div>
            <div className="md:w-[55%] p-7 flex flex-col gap-3 justify-center">
              <span className="text-apc-red text-xs font-bold uppercase tracking-wider">Nền tảng</span>
              <h3 className="font-display-lg text-2xl font-bold text-on-surface">UMT Online Judge (UMTOJ)</h3>
              <p className="text-on-surface-variant leading-relaxed">
                Chấm bài tự động và luyện tập lập trình thi đấu dành riêng cho sinh viên UMT — hỗ trợ đa ngôn ngữ, phân
                loại độ khó và bảng xếp hạng realtime.
              </p>
              <div className="flex flex-wrap gap-2">
                {UMTOJ_TAGS.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-surface-container-highest text-on-surface-variant rounded-full text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <a className="text-apc-red font-bold flex items-center gap-2 mt-1 hover:gap-3 transition-all" href="#">
                Trải nghiệm ngay <span className="material-symbols-outlined">arrow_forward</span>
              </a>
            </div>
          </article>

          {/* Event Manager — card dọc */}
          <article className="lg:col-span-4 bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col">
            <div className="overflow-hidden">
              <img
                alt="APC Event Manager"
                className="w-full h-44 object-cover"
                src="/assets/home/07-apc-event-manager.jpg"
              />
            </div>
            <div className="p-6 flex flex-col gap-2 flex-1">
              <span className="text-apc-blue text-xs font-bold uppercase tracking-wider">Công cụ</span>
              <h3 className="font-bold text-xl text-on-surface">APC Event Manager</h3>
              <p className="text-on-surface-variant text-sm flex-1">
                Quản lý sự kiện, điểm danh và cấp certificate tự động cho các hoạt động của câu lạc bộ.
              </p>
              <a className="text-apc-blue font-bold flex items-center gap-2 hover:gap-3 transition-all" href="#">
                Xem chi tiết <span className="material-symbols-outlined">arrow_forward</span>
              </a>
            </div>
          </article>

          {/* CTA — dải ngang toàn chiều rộng */}
          <div className="lg:col-span-12 bg-apc-red rounded-2xl p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative overflow-hidden shadow-xl">
            <div className="relative z-10">
              <h3 className="font-bold text-2xl text-white mb-2">Và nhiều dự án khác đang chờ bạn</h3>
              <p className="text-white/90">Tham gia APC để cùng hiện thực hóa ý tưởng của bạn.</p>
            </div>
            <Button variant="light" className="relative z-10 font-bold w-max shrink-0">
              Đề xuất dự án
            </Button>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
              <span className="material-symbols-outlined text-[140px] text-white">rocket_launch</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

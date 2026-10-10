import { Link } from 'react-router-dom'

import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { ProjectCard } from '../../../components/ProjectCard'
import { MOCK_PROJECTS } from '../../projects/list/mock'

export function ProjectsSection() {
  const umtoj = MOCK_PROJECTS.find((p) => p.slug === 'umt-online-judge') ?? MOCK_PROJECTS[0]!
  const eventManager = MOCK_PROJECTS.find((p) => p.slug === 'apc-event-manager') ?? MOCK_PROJECTS[1]!

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
          <Link className="text-apc-blue font-medium flex items-center gap-1 hover:underline text-sm" to="/projects">
            Xem tất cả dự án <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* UMTOJ — card nổi bật, ảnh trái / nội dung phải */}
          <ProjectCard item={umtoj} layout="featured" className="lg:col-span-8" />

          {/* Event Manager — card dọc */}
          <ProjectCard item={eventManager} layout="standard" className="lg:col-span-4" />


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

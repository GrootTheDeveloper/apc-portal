import { Link } from 'react-router-dom'

import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { ProjectCard } from '../../../components/ProjectCard'
import { useApi } from '../../../hooks/useApi'
import type { Page } from '../../../lib/api'
import type { ProjectItem } from '../../../lib/content'

export function ProjectsSection() {
  const { data, loading, error } = useApi<Page<ProjectItem>>('/public/projects?page=1&pageSize=3')

  // Nếu đang tải, lỗi, hoặc danh sách rỗng: ẩn toàn bộ khối, không để khoảng trống (FLOW-01)
  if (loading || error || !data?.items || data.items.length === 0) {
    return null
  }

  const items = data.items.slice(0, 3)

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
          {items.length === 1 && (
            <ProjectCard item={items[0]!} layout="featured" className="lg:col-span-12" />
          )}

          {items.length === 2 && (
            <>
              <ProjectCard item={items[0]!} layout="featured" className="lg:col-span-8" />
              <ProjectCard item={items[1]!} layout="standard" className="lg:col-span-4" />
            </>
          )}

          {items.length >= 3 && (
            <>
              {items.map((item) => (
                <ProjectCard key={item.slug} item={item} layout="standard" className="lg:col-span-4" />
              ))}
            </>
          )}

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

import { useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { PageHero } from '../../../components/PageHero'
import { Pagination } from '../../../components/Pagination'
import { SearchBox } from '../../../components/SearchBox'
import { ProjectCard } from '../../../components/ProjectCard'
import { useApi } from '../../../hooks/useApi'
import type { Page } from '../../../lib/api'
import type { ProjectItem } from '../../../lib/content'

const PAGE_SIZE = 12

/** Trang danh sách dự án (phân trang, đủ 4 trạng thái). Bộ lọc loại `?type=` thêm ở C4 khi có trường `type`. */
export function ProjectListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

  const { data, loading, error, reload } = useApi<Page<ProjectItem>>(`/public/projects?page=${currentPage}&pageSize=${PAGE_SIZE}`)

  const handlePageChange = (page: number) => {
    const nextParams = new URLSearchParams(searchParams)
    if (page <= 1) {
      nextParams.delete('page')
    } else {
      nextParams.set('page', page.toString())
    }
    setSearchParams(nextParams)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const items = data?.items ?? []
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  return (
    <main>
      <PageHero
        comment="sản phẩm & dự án"
        title={
          <>
            Dự án do <span className="text-apc-gold">thành viên</span> làm.
          </>
        }
        lede="Sản phẩm công nghệ thật, được thành viên APC nghiên cứu, xây dựng và vận hành."
      />
      <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
        <div className="mx-auto w-full max-w-container-max">
          <SearchBox />
          <AsyncState loading={loading} error={error} empty={items.length === 0} emptyText="Chưa có dự án nào." onRetry={reload}>
            <div className="grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <ProjectCard key={item.slug} item={item} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-16">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
              </div>
            )}
          </AsyncState>
        </div>
      </section>
    </main>
  )
}

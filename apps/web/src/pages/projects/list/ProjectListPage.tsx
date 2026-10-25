import { useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Eyebrow } from '../../../components/Eyebrow'
import { Pagination } from '../../../components/Pagination'
import { ProjectCard } from '../../../components/ProjectCard'
import { useApi } from '../../../hooks/useApi'
import type { Page } from '../../../lib/api'
import type { ProjectItem } from '../../../lib/content'

const PAGE_SIZE = 12

/** Trang danh sách dự án (phân trang, đủ 4 trạng thái async). Bộ lọc loại `?type=` thêm ở C4 khi có trường `type`. */
export function ProjectListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const pageParam = searchParams.get('page')
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1)

  const queryParams = new URLSearchParams()
  queryParams.set('page', currentPage.toString())
  queryParams.set('pageSize', PAGE_SIZE.toString())

  const { data, loading, error, reload } = useApi<Page<ProjectItem>>(
    `/public/projects?${queryParams.toString()}`,
  )

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
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <main className="w-full min-h-[60vh] py-12 px-gutter bg-white">
      <div className="max-w-container-max mx-auto fade-up w-full">
        {/* Tiêu đề trang */}
        <div className="mb-8 border-b border-outline-variant/20 pb-6">
          <Eyebrow className="text-apc-blue mb-2">SẢN PHẨM &amp; DỰ ÁN</Eyebrow>
          <h1 className="font-headline-md text-3xl md:text-4xl font-bold text-on-surface">
            Dự án &amp; Sản phẩm
          </h1>
          <p className="mt-2 text-on-surface-variant text-base">
            Khám phá các sản phẩm công nghệ thực tế được nghiên cứu và phát triển bởi các thành viên APC.
          </p>
        </div>

        {/* Trạng thái dữ liệu */}
        <AsyncState
          loading={loading}
          error={error}
          empty={items.length === 0}
          emptyText="Chưa có dự án nào."
          onRetry={reload}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <ProjectCard key={item.slug} item={item} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-12 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </AsyncState>

      </div>
    </main>
  )
}

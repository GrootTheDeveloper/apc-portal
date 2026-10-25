import { useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { pillClass } from '../../../components/buttonClass'
import { PageHero } from '../../../components/PageHero'
import { Pagination } from '../../../components/Pagination'
import { ProjectCard } from '../../../components/ProjectCard'
import { useMockApi } from '../../../hooks/useMockApi'
import { getProjectList, PROJECT_TYPES, type ProjectItem } from './mock'
import type { Page } from '../../../lib/api'

const PAGE_SIZE = 12

/** Trang danh sách dự án (hỗ trợ phân trang, lọc theo thể loại, đủ 5 trạng thái) */
export function ProjectListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const currentType = searchParams.get('type') || undefined
  const pageParam = searchParams.get('page')
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1)

  const { data, loading, error, reload } = useMockApi<Page<ProjectItem>>(
    () => getProjectList({ page: currentPage, pageSize: PAGE_SIZE, type: currentType }),
    [currentPage, currentType],
  )

  const handleTypeChange = (type?: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (type) {
      nextParams.set('type', type)
    } else {
      nextParams.delete('type')
    }
    nextParams.delete('page')
    setSearchParams(nextParams)
  }

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
  const hasFilter = Boolean(currentType)
  const isEmpty = !loading && !error && items.length === 0

  const filters = [{ label: 'Tất cả', value: undefined }, ...PROJECT_TYPES.map((type) => ({ label: type, value: type }))]

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
          <div role="group" aria-label="Lọc theo loại dự án" className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.label}
                type="button"
                aria-pressed={currentType === filter.value}
                onClick={() => handleTypeChange(filter.value)}
                className={pillClass(currentType === filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <AsyncState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText={hasFilter ? 'Không có dự án nào trong loại này.' : 'Chưa có dự án nào.'}
            onRetry={reload}
          >
            <div className="mt-10 grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
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

          {isEmpty && hasFilter && (
            <div className="-mt-8 pb-16 text-center">
              <Button variant="outline" onClick={() => handleTypeChange(undefined)}>
                Xóa bộ lọc
              </Button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

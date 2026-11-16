import { useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState.js'
import { buttonClass } from '../../../components/buttonClass.js'
import { PageHero } from '../../../components/PageHero.js'
import { Pagination } from '../../../components/Pagination.js'
import { ProjectCard } from '../../../components/ProjectCard.js'
import { SearchBox } from '../../../components/SearchBox.js'
import { useApi } from '../../../hooks/useApi.js'
import type { Page } from '../../../lib/api.js'
import { PROJECT_TYPE_BADGE, PROJECT_TYPE_LABEL, type ProjectItem, type ProjectType } from '../types.js'

const PAGE_SIZE = 12
const TYPES = Object.keys(PROJECT_TYPE_LABEL) as ProjectType[]

// Class chung cho nút lọc loại; trạng thái chọn tô đặc, chưa chọn nền nhạt (literal đầy đủ cho Tailwind JIT).
const filterButtonClass = 'min-h-11 rounded-full px-5 text-[15px] font-bold transition-colors'

/** Trang danh sách dự án công khai (phân trang, đủ 4 trạng thái). Bộ lọc loại `?type=` giữ trên URL (C4). */
export function ProjectListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const type = searchParams.get('type') ?? ''

  const query = new URLSearchParams({ page: String(currentPage), pageSize: String(PAGE_SIZE) })
  if (type) query.set('type', type)
  const { data, loading, error, reload } = useApi<Page<ProjectItem>>(`/public/projects?${query}`)

  function selectType(value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('type', value)
    else next.delete('type')
    // Đổi bộ lọc thì về trang 1; reload giữ nguyên filter vì filter nằm trên URL.
    next.delete('page')
    setSearchParams(next)
  }

  function clearFilter() {
    setSearchParams(new URLSearchParams())
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

  const filtered = type !== ''
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

          <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo loại">
            <button
              type="button"
              aria-pressed={type === ''}
              onClick={() => selectType('')}
              className={`${filterButtonClass} ${type === '' ? 'bg-ink text-paper' : 'bg-soft text-ink hover:bg-apc-blue-pale'}`}
            >
              Tất cả
            </button>
            {TYPES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => selectType(value)}
                className={`${filterButtonClass} ${type === value ? 'bg-ink text-paper' : 'bg-soft text-ink hover:bg-apc-blue-pale'}`}
              >
                {PROJECT_TYPE_LABEL[value]}
              </button>
            ))}
          </div>

          <AsyncState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText={filtered ? 'Không có dự án khớp bộ lọc.' : 'Chưa có dự án nào.'}
            emptyAction={
              filtered ? (
                <button type="button" onClick={clearFilter} className={buttonClass('outline')}>
                  Xóa bộ lọc
                </button>
              ) : undefined
            }
            onRetry={reload}
          >
            <div className="grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                // Badge loại đặt ở trang list (không sửa ProjectCard dùng chung với home và /search).
                <div key={item.slug} className="flex min-w-0 flex-col gap-3">
                  <span className={`self-start rounded-full px-3 py-1 text-[12px] font-bold ${PROJECT_TYPE_BADGE[item.type]}`}>
                    {PROJECT_TYPE_LABEL[item.type]}
                  </span>
                  <ProjectCard item={item} />
                </div>
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

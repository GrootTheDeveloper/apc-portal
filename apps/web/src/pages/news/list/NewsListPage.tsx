import { useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { pillClass } from '../../../components/buttonClass'
import { PageHero } from '../../../components/PageHero'
import { NewsCard } from '../../../components/NewsCard'
import { Pagination } from '../../../components/Pagination'
import { SearchBox } from '../../../components/SearchBox'
import { useApi } from '../../../hooks/useApi'
import type { Page } from '../../../lib/api'
import { NEWS_CATEGORIES, type NewsItem } from '../../../lib/content'

const PAGE_SIZE = 12

/** Trang danh sách tin tức (hỗ trợ phân trang, lọc chuyên mục, đủ 4 trạng thái async) */
export function NewsListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const currentCategory = searchParams.get('category') || undefined
  const pageParam = searchParams.get('page')
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1)

  const queryParams = new URLSearchParams()
  queryParams.set('page', currentPage.toString())
  queryParams.set('pageSize', PAGE_SIZE.toString())
  if (currentCategory) {
    queryParams.set('category', currentCategory)
  }

  const { data, loading, error, reload } = useApi<Page<NewsItem>>(
    `/public/news?${queryParams.toString()}`,
  )

  const handleCategoryChange = (category?: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (category) {
      nextParams.set('category', category)
    } else {
      nextParams.delete('category')
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
  const hasFilter = Boolean(currentCategory)
  const isEmpty = !loading && !error && items.length === 0

  const filters = [{ label: 'Tất cả', value: undefined }, ...NEWS_CATEGORIES.map((category) => ({ label: category, value: category }))]

  return (
    <main>
      <PageHero
        tone="gold"
        comment="blog & tin tức"
        title="Tin tức & chia sẻ"
        lede="Kiến thức công nghệ, chuyện hoạt động và thông báo mới nhất từ APC."
      />
      <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
        <div className="mx-auto w-full max-w-container-max">
          <div role="group" aria-label="Lọc theo chuyên mục" className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.label}
                type="button"
                aria-pressed={currentCategory === filter.value}
                onClick={() => handleCategoryChange(filter.value)}
                className={pillClass(currentCategory === filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <SearchBox />

          <AsyncState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText={hasFilter ? 'Không có bài viết nào trong chuyên mục này.' : 'Chưa có bài viết nào.'}
            onRetry={reload}
          >
            <div className="mt-10 grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <NewsCard key={item.slug} item={item} />
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
              <Button variant="outline" onClick={() => handleCategoryChange(undefined)}>
                Xóa bộ lọc
              </Button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

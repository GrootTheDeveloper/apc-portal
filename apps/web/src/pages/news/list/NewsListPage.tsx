import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { NewsCard } from '../../../components/NewsCard'
import { Pagination } from '../../../components/Pagination'
import { ApiError, type Page } from '../../../lib/api'
import { getNewsList, NEWS_CATEGORIES, type NewsItem } from './mock'

const PAGE_SIZE = 12

type Result = {
  key: string | null
  data?: Page<NewsItem>
  error?: ApiError
}

/** Trang danh sách tin tức (hỗ trợ phân trang, lọc chuyên mục, đủ 5 trạng thái) */
export function NewsListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const currentCategory = searchParams.get('category') || undefined
  const pageParam = searchParams.get('page')
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1)

  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result>({ key: null })

  const key = `${attempt}:${currentPage}:${currentCategory ?? ''}`

  useEffect(() => {
    let cancelled = false

    getNewsList({
      page: currentPage,
      pageSize: PAGE_SIZE,
      category: currentCategory,
    })
      .then((res) => {
        if (!cancelled) {
          setResult({ key, data: res })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({
            key,
            error:
              err instanceof ApiError
                ? err
                : new ApiError(500, 'unknown', 'Đã có lỗi xảy ra. Vui lòng thử lại.'),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [currentPage, currentCategory, key])

  const loading = result.key !== key
  const error = loading ? undefined : result.error
  const data = loading ? undefined : result.data

  const reload = () => setAttempt((count) => count + 1)

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

  return (
    <main className="w-full min-h-[60vh] py-12 px-gutter bg-white">
      <div className="max-w-container-max mx-auto fade-up w-full">
        {/* Tiêu đề trang */}
        <div className="mb-8 border-b border-outline-variant/20 pb-6">
          <Eyebrow className="text-apc-blue mb-2">BLOG &amp; TIN TỨC</Eyebrow>
          <h1 className="font-headline-md text-3xl md:text-4xl font-bold text-on-surface">
            Tin tức &amp; Cập nhật
          </h1>
          <p className="mt-2 text-on-surface-variant text-base">
            Chia sẻ kiến thức công nghệ, câu chuyện hoạt động và thông báo mới nhất từ câu lạc bộ APC.
          </p>
        </div>

        {/* Bộ lọc chuyên mục */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <button
            type="button"
            onClick={() => handleCategoryChange(undefined)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !currentCategory
                ? 'bg-apc-blue text-white shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/30'
            }`}
          >
            Tất cả
          </button>
          {NEWS_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => handleCategoryChange(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                currentCategory === category
                  ? 'bg-apc-blue text-white shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/30'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Trạng thái dữ liệu */}
        <AsyncState
          loading={loading}
          error={error}
          empty={items.length === 0}
          emptyText={
            hasFilter
              ? 'Không có bài viết nào trong chuyên mục này.'
              : 'Chưa có bài viết nào.'
          }
          onRetry={reload}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map((item) => (
              <NewsCard key={item.slug} item={item} />
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

        {/* Nút Xóa bộ lọc khi lọc không có kết quả */}
        {isEmpty && hasFilter && (
          <div className="text-center -mt-8 pb-16">
            <Button variant="outline" onClick={() => handleCategoryChange(undefined)}>
              Xóa bộ lọc
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}

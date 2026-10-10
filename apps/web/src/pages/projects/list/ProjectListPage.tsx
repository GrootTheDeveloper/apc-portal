import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { Pagination } from '../../../components/Pagination'
import { ProjectCard } from '../../../components/ProjectCard'
import { ApiError, type Page } from '../../../lib/api'
import { getProjectList, PROJECT_TYPES, type ProjectItem } from './mock'

const PAGE_SIZE = 12

type Result = {
  key: string | null
  data?: Page<ProjectItem>
  error?: ApiError
}

/** Trang danh sách dự án (hỗ trợ phân trang, lọc theo thể loại, đủ 5 trạng thái) */
export function ProjectListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const currentType = searchParams.get('type') || undefined
  const pageParam = searchParams.get('page')
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1)

  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result>({ key: null })

  const key = `${attempt}:${currentPage}:${currentType ?? ''}`

  useEffect(() => {
    let cancelled = false

    getProjectList({
      page: currentPage,
      pageSize: PAGE_SIZE,
      type: currentType,
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
  }, [currentPage, currentType, key])

  const loading = result.key !== key
  const error = loading ? undefined : result.error
  const data = loading ? undefined : result.data

  const reload = () => setAttempt((count) => count + 1)

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

        {/* Bộ lọc thể loại */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <button
            type="button"
            onClick={() => handleTypeChange(undefined)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !currentType
                ? 'bg-apc-blue text-white shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/30'
            }`}
          >
            Tất cả
          </button>
          {PROJECT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                currentType === type
                  ? 'bg-apc-blue text-white shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/30'
              }`}
            >
              {type}
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
              ? 'Không có dự án nào trong thể loại này.'
              : 'Chưa có dự án nào.'
          }
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

        {/* Nút Xóa bộ lọc khi lọc không có kết quả */}
        {isEmpty && hasFilter && (
          <div className="text-center -mt-8 pb-16">
            <Button variant="outline" onClick={() => handleTypeChange(undefined)}>
              Xóa bộ lọc
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}

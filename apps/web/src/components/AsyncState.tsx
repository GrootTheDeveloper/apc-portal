import type { ReactNode } from 'react'

import type { ApiError } from '../lib/api'
import { Button } from './Button'

type AsyncStateProps = {
  loading: boolean
  error?: ApiError | undefined
  empty: boolean
  emptyText?: string
  onRetry?: () => void
  children: ReactNode
}

/**
 * Đủ 4 trạng thái cho mọi trang (AGENTS.md): đang tải / lỗi / rỗng / có dữ liệu.
 *   const news = useApi<Page<NewsItem>>('/public/news')
 *   <AsyncState loading={news.loading} error={news.error} empty={news.data?.items.length === 0}
 *               emptyText="Chưa có tin tức nào." onRetry={news.reload}>
 *     {news.data?.items.map(...)}
 *   </AsyncState>
 */
export function AsyncState({
  loading,
  error,
  empty,
  emptyText = 'Chưa có dữ liệu.',
  onRetry,
  children,
}: AsyncStateProps) {
  if (loading) {
    return (
      <p role="status" className="py-16 text-center text-on-surface-variant">
        Đang tải…
      </p>
    )
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-on-surface">{error.message}</p>
        {onRetry && (
          <Button variant="outline" className="px-6 py-2" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </div>
    )
  }
  if (empty) return <p className="py-16 text-center text-on-surface-variant">{emptyText}</p>
  return <>{children}</>
}

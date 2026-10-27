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
      <p role="status" className="py-20 text-center font-code text-[16px] font-bold text-muted">
        đang tải
        <span aria-hidden className="caret" />
      </p>
    )
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-5 py-20 text-center">
        <p className="font-code text-[14px] font-bold text-apc-red">{'// lỗi'}</p>
        <p className="max-w-[48ch] font-display text-[clamp(22px,2.4vw,30px)] font-bold leading-tight">{error.message}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </div>
    )
  }
  if (empty) {
    return <p className="py-20 text-center font-display text-[clamp(22px,2.4vw,30px)] font-bold leading-tight text-muted">{emptyText}</p>
  }
  return <>{children}</>
}

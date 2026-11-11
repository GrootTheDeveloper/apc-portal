import { useEffect, useState } from 'react'

import { api, ApiError, type ApiOptions } from '../lib/api'

type Result<T> = { key: string | null; data?: T; error?: ApiError }

/**
 * Tải dữ liệu cho một trang. Đổi `path` hoặc `options` là tự tải lại; `reload()` cho nút "Thử lại".
 *   const news = useApi<Page<NewsItem>>(`/public/news?page=${page}`)
 *   const apps = useApi<Page<ApplicationListItem>>(`/admin/recruitment/${id}/applications/search`, { method: 'POST', body })
 * Truyền `null` khi chưa đủ điều kiện gọi (vd chưa có slug).
 */
export function useApi<T>(path: string | null, options?: ApiOptions) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<T>>({ key: null })
  const optionsKey = options ? `${options.method ?? ''}:${JSON.stringify(options.body ?? '')}` : ''
  const key = path === null ? null : `${attempt}:${path}:${optionsKey}`

  useEffect(() => {
    if (path === null || key === null) return
    let cancelled = false
    api<T>(path, options).then(
      (data) => !cancelled && setResult({ key, data }),
      (error: unknown) =>
        !cancelled &&
        setResult({
          key,
          error: error instanceof ApiError ? error : new ApiError(0, 'unknown', 'Đã có lỗi xảy ra. Vui lòng thử lại.'),
        }),
    )
    return () => {
      cancelled = true
    }
  }, [path, key, options])

  // Đang tải = kết quả hiện có chưa phải của lần gọi mới nhất.
  const loading = key !== null && result.key !== key
  return {
    data: loading ? undefined : result.data,
    error: loading ? undefined : result.error,
    loading,
    reload: () => setAttempt((count) => count + 1),
  }
}

import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../lib/api'

type Result<T> = { key: string | null; data?: T; error?: ApiError }

/**
 * Bản tạm của useApi cho dữ liệu giả ở C1, trả về cùng dạng { data, loading, error, reload }.
 * C2 đổi các trang sang useApi(...) rồi xóa file này.
 *   const { data, loading, error, reload } = useMockApi(() => getProjectList(params), [dep1, dep2])
 *
 * - `fetcher` là hàm trả Promise — được gọi lại mỗi khi deps thay đổi hoặc reload() được gọi.
 * - deps tương đương dependency array của useEffect.
 * - Khi reload() được gọi, key tăng lên → useEffect chạy lại.
 */
export function useMockApi<T>(
  fetcher: () => Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: readonly any[],
): { data: T | undefined; loading: boolean; error: ApiError | undefined; reload: () => void } {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<T>>({ key: null })

  // Dùng ref để lưu fetcher mới nhất, tránh đưa vào deps của useEffect.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  // key phân biệt "lần gọi hiện tại" — bao gồm attempt và tất cả deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const key = [attempt, ...deps].join(':')

  useEffect(() => {
    let cancelled = false

    fetcherRef.current().then(
      (data) => {
        if (!cancelled) setResult({ key, data })
      },
      (err: unknown) => {
        if (!cancelled)
          setResult({
            key,
            error:
              err instanceof ApiError
                ? err
                : new ApiError(500, 'unknown', 'Đã có lỗi xảy ra. Vui lòng thử lại.'),
          })
      },
    )

    return () => {
      cancelled = true
    }
    // key đã encode đủ attempt + deps, nên chỉ cần key trong deps list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const loading = result.key !== key
  return {
    data: loading ? undefined : result.data,
    error: loading ? undefined : result.error,
    loading,
    reload: () => setAttempt((c) => c + 1),
  }
}

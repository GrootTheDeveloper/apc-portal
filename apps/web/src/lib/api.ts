// Gọi API cho cả web. Mọi request đi qua /api (local: proxy trong vite.config.ts, production: Nginx),
// nên web và API cùng origin: cookie phiên tự đi kèm, không cần CORS.
//
// Ví dụ:
//   const news = await api<Page<NewsItem>>('/public/news?page=1&pageSize=20')
//   await api('/auth/login', { body: { username, password } })
//   try { ... } catch (error) { if (error instanceof ApiError && error.status === 422) showFieldErrors(error.issues) }

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number }

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly issues: unknown[]

  constructor(status: number, code: string, message: string, issues: unknown[] = []) {
    super(message)
    this.status = status
    this.code = code
    this.issues = issues
  }
}

type Options = { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown }

export async function api<T = unknown>(path: string, { method, body }: Options = {}): Promise<T> {
  const init: RequestInit = { method: method ?? (body === undefined ? 'GET' : 'POST') }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`/api${path}`, init)
  } catch {
    throw new ApiError(0, 'network', 'Không kết nối được máy chủ. Vui lòng thử lại.')
  }

  const data = response.status === 204 ? undefined : await response.json().catch(() => undefined)
  if (!response.ok && data === undefined && response.status >= 502) {
    throw new ApiError(response.status, 'network', 'Không kết nối được máy chủ. Vui lòng thử lại.')
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error ?? 'unknown',
      data?.message ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.',
      data?.issues,
    )
  }
  return data as T
}

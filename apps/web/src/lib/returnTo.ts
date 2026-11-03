export const DEFAULT_AFTER_LOGIN = '/portal'

/**
 * Trang quay lại sau đăng nhập (Sitemap mục 11.2). Chỉ nhận path nội bộ mà `isAppPath` công nhận
 * (danh sách route lấy thẳng từ router — `isAppPath` trong src/routes.tsx), giữ nguyên query string.
 * URL tuyệt đối, `//domain`, dấu `\`, ký tự điều khiển, /login hoặc route không tồn tại đều về /portal (chống open redirect).
 */
export function safeReturnTo(value: string | null | undefined, isAppPath: (pathname: string) => boolean): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_AFTER_LOGIN
  // eslint-disable-next-line no-control-regex -- chặn cả tab/xuống dòng mà trình duyệt tự bỏ đi trong URL
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return DEFAULT_AFTER_LOGIN

  const pathname = value.split(/[?#]/, 1)[0] ?? ''
  if (pathname === '/login' || pathname.includes('/../') || pathname.endsWith('/..')) return DEFAULT_AFTER_LOGIN
  return isAppPath(pathname) ? value : DEFAULT_AFTER_LOGIN
}

/** Link tới trang đăng nhập, nhớ trang đang định vào. */
export function loginUrl(currentPath: string): string {
  return `/login?returnTo=${encodeURIComponent(currentPath)}`
}

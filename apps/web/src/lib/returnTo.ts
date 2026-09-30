export const DEFAULT_AFTER_LOGIN = '/portal'

/**
 * Trang quay lại sau đăng nhập (sitemap mục 11.2). Chỉ nhận path nội bộ bắt đầu bằng một dấu `/`;
 * URL tuyệt đối, `//domain`, dấu `\` hoặc ký tự điều khiển đều bị bỏ để tránh open redirect.
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_AFTER_LOGIN
  // eslint-disable-next-line no-control-regex -- chặn cả tab/xuống dòng mà trình duyệt tự bỏ đi trong URL
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return DEFAULT_AFTER_LOGIN
  if (value === '/login' || value.startsWith('/login?') || value.startsWith('/login/')) return DEFAULT_AFTER_LOGIN
  return value
}

/** Link tới trang đăng nhập, nhớ trang đang định vào. */
export function loginUrl(currentPath: string): string {
  return `/login?returnTo=${encodeURIComponent(currentPath)}`
}

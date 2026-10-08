import { matchPath } from 'react-router-dom'

export const DEFAULT_AFTER_LOGIN = '/portal'

// Route có thật của web được phép quay lại sau đăng nhập (Sitemap mục 11.2).
// Thêm route mới trong App.tsx thì thêm vào đây (trừ /login).
export const RETURN_TO_ROUTES = [
  '/',
  '/about',
  '/news',
  '/events',
  '/events/registration-lookup',
  '/projects',
  '/recruitment',
  '/recruitment/application-lookup',
  '/privacy',
  '/account/activate',
  '/portal',
  '/admin',
] as const

/**
 * Trang quay lại sau đăng nhập. Chỉ nhận path nội bộ thuộc RETURN_TO_ROUTES (giữ nguyên query string);
 * URL tuyệt đối, `//domain`, dấu `\`, ký tự điều khiển hoặc route không tồn tại đều về /portal (chống open redirect).
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_AFTER_LOGIN
  // eslint-disable-next-line no-control-regex -- chặn cả tab/xuống dòng mà trình duyệt tự bỏ đi trong URL
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return DEFAULT_AFTER_LOGIN

  const pathname = value.split(/[?#]/, 1)[0] ?? ''
  const known = RETURN_TO_ROUTES.some((route) => matchPath({ path: route, end: true }, pathname))
  return known ? value : DEFAULT_AFTER_LOGIN
}

/** Link tới trang đăng nhập, nhớ trang đang định vào. */
export function loginUrl(currentPath: string): string {
  return `/login?returnTo=${encodeURIComponent(currentPath)}`
}

import type { AppConfig } from '../../config.js'

/** Sinh robots.txt (PAGE-SYS-06): chặn crawler khỏi vùng cần đăng nhập, biểu mẫu và tra cứu,
 *  không chặn /search vì trang đó tự đặt noindex, follow (docs/04-sitemap.md §16).
 *  Robots.txt không phải biện pháp bảo mật — backend vẫn tự kiểm quyền */
export function buildRobots(config: AppConfig): string {
  const baseUrl = config.WEB_URL.replace(/\/$/, '')

  return [
    'User-agent: *',
    'Disallow: /login',
    'Disallow: /account',
    'Disallow: /portal',
    'Disallow: /admin',
    'Disallow: /news/*/preview',
    'Disallow: /projects/*/preview',
    'Disallow: /events/*/preview',
    'Disallow: /recruitment/*/apply',
    'Disallow: /recruitment/lookup',
    'Disallow: /events/*/register',
    'Disallow: /events/lookup',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n')
}
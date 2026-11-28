import type { AppConfig } from '../../config.js'
import { db } from '../../db/client.js'

// Trang tĩnh luôn có trong sitemap; không đưa tìm kiếm, biểu mẫu, tra cứu, đăng nhập, portal, admin
// (docs/04-sitemap.md §16, PAGE-SYS-05).
const STATIC_PATHS = ['/', '/about', '/news', '/events', '/projects', '/recruitment', '/privacy']

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

type Entry = { path: string; updatedAt: Date | null }

/** Sinh sitemap.xml từ nội dung đang công khai trong database; URL tuyệt đối theo WEB_URL. */
export async function buildSitemap(config: AppConfig): Promise<string> {
  const baseUrl = config.WEB_URL.replace(/\/$/, '')
  const [posts, projects, events] = await Promise.all([
    db.post.findMany({
      where: { status: 'PUBLISHED', scope: 'PUBLIC' },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    db.project.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    // Sự kiện đã kết thúc vẫn là nội dung công khai còn giá trị, khác với DRAFT/CANCELLED/ARCHIVED.
    db.event.findMany({
      where: { status: { in: ['PUBLISHED', 'ENDED'] } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  const entries: Entry[] = [
    ...STATIC_PATHS.map((path) => ({ path, updatedAt: null })),
    ...posts.map((item) => ({ path: `/news/${item.slug}`, updatedAt: item.updatedAt })),
    ...projects.map((item) => ({ path: `/projects/${item.slug}`, updatedAt: item.updatedAt })),
    ...events.map((item) => ({ path: `/events/${item.slug}`, updatedAt: item.updatedAt })),
  ]
  // Trang tĩnh không có ngày cập nhật thật nên không ghi lastmod.
  const urls = entries
    .map(({ path, updatedAt }) => {
      const lastmod = updatedAt === null ? '' : `<lastmod>${updatedAt.toISOString()}</lastmod>`
      return `<url><loc>${escapeXml(baseUrl + path)}</loc>${lastmod}</url>`
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
  ].join('\n')
}
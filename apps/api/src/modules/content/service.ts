import { z } from 'zod'

import { db } from '../../db/client.js'
import { notFound } from '../../lib/errors.js'
import { pageArgs, pageQuery, toPage } from '../../lib/pagination.js'
import { eventListSelect, publicVisible } from '../events/service.js'

// ─── SCHEMA VALIDATION ───────────────────────────────────────────────────────

/** Query params cho danh sách bài viết (tin tức), mở rộng từ pageQuery chung. */
export const newsListQuery = pageQuery.extend({
  // Lọc theo chuyên mục (tùy chọn)
  category: z.string().trim().min(1).optional(),
  // Ghi đè pageSize mặc định thành 12 theo yêu cầu nghiệp vụ
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
})

/** Query params cho danh sách dự án. Lọc theo loại (`?type=`) thêm ở C4 cùng migration trường `type`. */
export const projectListQuery = pageQuery.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
})

export const publicSearchQuery = z.object({ q: z.string().trim().max(100).default('') })

/** Mới công bố trước; cùng thời điểm thì theo id để phân trang không lặp/sót mục. */
const newestFirst = [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }] as const

// ─── NEWS (POST) ──────────────────────────────────────────────────────────────

/** Bài công khai: đã công bố và phạm vi PUBLIC. Bài nháp, lưu trữ, nội bộ coi như không tồn tại (docs/02 §12). */
const publicPost = { status: 'PUBLISHED', scope: 'PUBLIC' } as const

/** Chỉ select các trường cần hiển thị — KHÔNG lấy authorId, publishedById, departmentId. */
const newsListSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  thumbnailUrl: true,
  category: true,
  publishedAt: true,
} as const

/** Trang chi tiết thêm nội dung và thẻ SEO. */
const newsDetailSelect = {
  ...newsListSelect,
  content: true,
  metaTitle: true,
  metaDescription: true,
} as const

/** Danh sách tin tức công khai, mới nhất trước. */
export async function listPublicNews(rawQuery: unknown) {
  const query = newsListQuery.parse(rawQuery)
  const where = { ...publicPost, ...(query.category ? { category: query.category } : {}) }

  const [items, total] = await db.$transaction([
    db.post.findMany({ where, orderBy: [...newestFirst], select: newsListSelect, ...pageArgs(query) }),
    db.post.count({ where }),
  ])
  return toPage(items, total, query)
}

/** Chi tiết tin tức công khai theo slug; không có hoặc chưa công khai thì 404. */
export async function getPublicNewsBySlug(slug: string) {
  const post = await db.post.findFirst({ where: { slug, ...publicPost }, select: newsDetailSelect })
  if (!post) throw notFound('Không tìm thấy bài viết.')
  return post
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────

/** Chỉ select các trường cần hiển thị — KHÔNG lấy createdById, departmentId. */
const projectSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  thumbnailUrl: true,
  technologies: true,
  projectUrl: true,
  sourceUrl: true,
  publishedAt: true,
} as const

/** Danh sách dự án đã công bố, mới nhất trước. */
export async function listPublishedProjects(rawQuery: unknown) {
  const query = projectListQuery.parse(rawQuery)
  const where = { status: 'PUBLISHED' } as const

  const [items, total] = await db.$transaction([
    db.project.findMany({ where, orderBy: [...newestFirst], select: projectSelect, ...pageArgs(query) }),
    db.project.count({ where }),
  ])
  return toPage(items, total, query)
}

/** Chi tiết dự án đã công bố theo slug; không có hoặc chưa công bố thì 404. */
export async function getPublishedProjectBySlug(slug: string) {
  const project = await db.project.findFirst({ where: { slug, status: 'PUBLISHED' }, select: projectSelect })
  if (!project) throw notFound('Không tìm thấy dự án.')
  return project
}

/** Prisma translates `contains` to SQL LIKE; quote LIKE metacharacters as literals. */
function escapeLikeQuery(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

/** Tìm nội dung theo tiêu đề, chỉ trong các nhóm đang công khai. */
export async function searchPublicContent(rawQuery: unknown) {
  const { q } = publicSearchQuery.parse(rawQuery)
  const titleFilter = q ? { title: { contains: escapeLikeQuery(q), mode: 'insensitive' as const } } : {}
  const [news, events, projects] = await Promise.all([
    db.post.findMany({
      where: { ...publicPost, ...titleFilter },
      orderBy: [...newestFirst],
      take: 10,
      select: newsListSelect,
    }),
    db.event.findMany({
      where: { ...publicVisible, ...titleFilter },
      orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
      take: 10,
      select: eventListSelect,
    }),
    db.project.findMany({
      where: { status: 'PUBLISHED', ...titleFilter },
      orderBy: [...newestFirst],
      take: 10,
      select: projectSelect,
    }),
  ])

  return { news, events, projects }
}

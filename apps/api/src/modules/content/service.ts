import { z } from 'zod'

import { db } from '../../db/client.js'
import { notFound } from '../../lib/errors.js'
import { pageArgs, pageQuery, toPage } from '../../lib/pagination.js'

// ─── SCHEMA VALIDATION ───────────────────────────────────────────────────────

/** Query params cho danh sách bài viết (tin tức), mở rộng từ pageQuery chung. */
export const newsListQuery = pageQuery.extend({
  // Lọc theo chuyên mục (tùy chọn)
  category: z.string().trim().min(1).optional(),
  // Ghi đè pageSize mặc định thành 12 theo yêu cầu nghiệp vụ
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
})

/** Query params cho danh sách dự án. */
export const projectListQuery = pageQuery.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
  // Schema hiện tại chưa có trường `type` trên bảng projects (TODO: thêm khi có migration).
  // type: z.string().trim().min(1).optional(),
})

// ─── NEWS (POST) ──────────────────────────────────────────────────────────────

/** Chỉ select các trường cần thiết cho danh sách tin tức — KHÔNG lấy authorId, publishedById, departmentId. */
const newsListSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  thumbnailUrl: true,
  category: true,
  publishedAt: true,
  metaTitle: true,
  metaDescription: true,
  // Cần để kiểm tra điều kiện visibility ở getPublicNewsBySlug
  status: true,
  scope: true,
} as const

/** Thêm `content` cho trang chi tiết. */
const newsDetailSelect = {
  ...newsListSelect,
  content: true,
} as const

/** Xóa status/scope trước khi trả ra ngoài (không phải trường công khai). */
function sanitizePost<T extends { status: unknown; scope: unknown }>(post: T) {
  const { status: _status, scope: _scope, ...safe } = post
  return safe
}

/**
 * Lấy danh sách bài viết tin tức công khai, đã công bố.
 * Điều kiện: status = 'PUBLISHED' && scope = 'PUBLIC'.
 * Sắp xếp: publishedAt giảm dần.
 */
export async function listPublicNews(rawQuery: unknown) {
  const query = newsListQuery.parse(rawQuery)

  const where = {
    status: 'PUBLISHED' as const,
    scope: 'PUBLIC' as const,
    // Lọc theo category nếu có
    ...(query.category ? { category: query.category } : {}),
  }

  const [rawItems, total] = await db.$transaction([
    db.post.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      select: newsListSelect,
      ...pageArgs(query),
    }),
    db.post.count({ where }),
  ])

  // Loại bỏ status/scope khỏi response trước khi trả ra
  const items = rawItems.map(sanitizePost)
  return toPage(items, total, query)
}

/**
 * Lấy chi tiết một bài viết tin tức công khai theo slug.
 * Điều kiện: status = 'PUBLISHED' && scope = 'PUBLIC'.
 * Nếu không tìm thấy hoặc bài không phải PUBLIC/PUBLISHED: trả 404.
 */
export async function getPublicNewsBySlug(slug: string) {
  const post = await db.post.findUnique({
    where: { slug },
    select: newsDetailSelect,
  })

  // Không tìm thấy, hoặc bài DRAFT/ARCHIVED/INTERNAL → trả 404
  // (không để lộ sự tồn tại của bài viết nội bộ — docs/02 §12)
  if (!post || post.status !== 'PUBLISHED' || post.scope !== 'PUBLIC') {
    throw notFound('Không tìm thấy bài viết.')
  }

  return sanitizePost(post)
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────

/** Chỉ select các trường cần thiết cho danh sách dự án — KHÔNG lấy createdById, departmentId. */
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
  // Cần để kiểm tra điều kiện visibility ở getPublishedProjectBySlug
  status: true,
} as const

/** Xóa status trước khi trả ra ngoài. */
function sanitizeProject<T extends { status: unknown }>(project: T) {
  const { status: _status, ...safe } = project
  return safe
}

/**
 * Lấy danh sách dự án đã công bố.
 * Điều kiện: status = 'PUBLISHED'.
 * Sắp xếp: publishedAt giảm dần.
 *
 * Lưu ý: Schema hiện tại chưa có trường `type` trên bảng projects.
 * Khi migration thêm `type` thì bỏ comment phần filter bên dưới.
 */
export async function listPublishedProjects(rawQuery: unknown) {
  const query = projectListQuery.parse(rawQuery)

  const where = {
    status: 'PUBLISHED' as const,
    // TODO: Bỏ comment khi schema có trường `type`:
    // ...(query.type ? { type: query.type } : {}),
  }

  const [rawItems, total] = await db.$transaction([
    db.project.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      select: projectSelect,
      ...pageArgs(query),
    }),
    db.project.count({ where }),
  ])

  // Loại bỏ status khỏi response trước khi trả ra
  const items = rawItems.map(sanitizeProject)
  return toPage(items, total, query)
}

/**
 * Lấy chi tiết một dự án đã công bố theo slug.
 * Điều kiện: status = 'PUBLISHED'.
 * Nếu không tìm thấy hoặc dự án chưa công bố: trả 404.
 */
export async function getPublishedProjectBySlug(slug: string) {
  const project = await db.project.findUnique({
    where: { slug },
    select: projectSelect,
  })

  // Không tìm thấy, hoặc dự án DRAFT/ARCHIVED → trả 404
  if (!project || project.status !== 'PUBLISHED') {
    throw notFound('Không tìm thấy dự án.')
  }

  return sanitizeProject(project)
}

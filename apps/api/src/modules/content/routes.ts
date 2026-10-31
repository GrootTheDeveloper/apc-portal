import type { FastifyInstance } from 'fastify'

import {
  getPublicNewsBySlug,
  getPublishedProjectBySlug,
  listPublicNews,
  listPublishedProjects,
  searchPublicContent,
} from './service.js'

export function contentRoutes() {
  return async function registerContentRoutes(app: FastifyInstance) {
    app.get('/public/search', async (request) => searchPublicContent(request.query))

    // ─── NEWS (TIN TỨC) ────────────────────────────────────────────────────

    /**
     * Danh sách bài viết tin tức công khai.
     * Không yêu cầu đăng nhập (public/*).
     * Query: page, pageSize (default 12), category (tùy chọn).
     */
    app.get('/public/news', async (request) => {
      return listPublicNews(request.query)
    })

    /**
     * Chi tiết bài viết tin tức theo slug.
     * Không yêu cầu đăng nhập (public/*).
     * 404 nếu bài không tồn tại, DRAFT, ARCHIVED, hoặc INTERNAL.
     */
    app.get('/public/news/:slug', async (request) => {
      const { slug } = request.params as { slug: string }
      return getPublicNewsBySlug(slug)
    })

    // ─── PROJECTS (DỰ ÁN) ──────────────────────────────────────────────────

    /**
     * Danh sách dự án đã công bố.
     * Không yêu cầu đăng nhập (public/*).
     * Query: page, pageSize (default 12), type (tạm thời nhận nhưng chưa filter — schema chưa có trường `type`).
     */
    app.get('/public/projects', async (request) => {
      return listPublishedProjects(request.query)
    })

    /**
     * Chi tiết dự án theo slug.
     * Không yêu cầu đăng nhập (public/*).
     * 404 nếu dự án không tồn tại hoặc chưa công bố (DRAFT/ARCHIVED).
     */
    app.get('/public/projects/:slug', async (request) => {
      const { slug } = request.params as { slug: string }
      return getPublishedProjectBySlug(slug)
    })
  }
}

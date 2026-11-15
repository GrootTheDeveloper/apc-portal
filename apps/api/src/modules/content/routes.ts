import type { FastifyInstance } from 'fastify'

import type { FilesContext } from '../files/service.js'
import {
  getPublicNewsBySlug,
  getPublishedProjectBySlug,
  listPublicNews,
  listPublishedProjects,
  projectMemberAvatar,
  searchPublicContent,
} from './service.js'

export function contentRoutes(context: FilesContext) {
  return async function registerContentRoutes(app: FastifyInstance) {
    app.get(
      '/public/search',
      { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
      async (request) => searchPublicContent(request.query),
    )

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
     * Query: page, pageSize (default 12), type (PROJECT | PRODUCT, tùy chọn).
     */
    app.get('/public/projects', async (request) => {
      return listPublishedProjects(request.query)
    })

    /**
     * Ảnh đại diện thành viên trên trang dự án công khai (PRT-04).
     * Đăng ký TRƯỚC /public/projects/:slug để Fastify khớp đúng path nhiều tầng.
     * 404 khi dự án chưa công bố, thành viên không thuộc dự án,
     * chưa đồng ý công khai ảnh hoặc chưa đặt ảnh đại diện.
     */
    app.get('/public/projects/:slug/members/:userId/avatar', async (request, reply) => {
      const { slug, userId } = request.params as { slug: string; userId: string }
      return projectMemberAvatar(context, reply, slug, userId)
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

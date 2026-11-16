import type { FastifyInstance } from 'fastify'

import { db } from '../../db/client.js'
import { currentUser, requireRole, requireScope } from '../auth/rbac.js'
import {
  changePostStatus,
  createAdminPost,
  getAdminPost,
  listAdminPosts,
  updateAdminPost,
} from './admin-posts.service.js'

export function adminPostsRoutes() {
  return async function registerAdminPostsRoutes(app: FastifyInstance) {
    // Tất cả route /admin/content/posts yêu cầu tối thiểu DEPARTMENT_MANAGER hoặc BOARD
    const requireManager = requireRole('DEPARTMENT_MANAGER', 'BOARD')

    // ── GET /admin/content/posts ──────────────────────────────────────────────
    /**
     * Danh sách bài viết quản trị, lọc theo phạm vi ban người gọi.
     * DEPARTMENT_MANAGER chỉ thấy bài của ban mình; BOARD thấy tất cả.
     * Filters: status, category, departmentId, scope (tùy chọn).
     */
    app.get(
      '/admin/content/posts',
      { preHandler: requireManager },
      async (request) => {
        const user = currentUser(request)
        return listAdminPosts(user, request.query)
      },
    )

    // ── GET /admin/content/posts/:id ──────────────────────────────────────────
    /**
     * Chi tiết bài viết quản trị.
     * requireScope đảm bảo 404 nếu bài không thuộc phạm vi ban người gọi (docs/02 §12.4).
     */
    app.get(
      '/admin/content/posts/:id',
      {
        preHandler: [
          requireManager,
          requireScope(({ id }) =>
            db.post.findUnique({ where: { id }, select: { departmentId: true } }),
          ),
        ],
      },
      async (request) => {
        const user = currentUser(request)
        const { id } = request.params as { id: string }
        return getAdminPost(user, id)
      },
    )

    // ── POST /admin/content/posts ─────────────────────────────────────────────
    /**
     * Tạo bài viết mới (DRAFT). authorId = người đang đăng nhập.
     * departmentId tự suy ra từ vai trò: BOARD → null, DEPARTMENT_MANAGER → ban đang quản lý.
     */
    app.post(
      '/admin/content/posts',
      { preHandler: requireManager },
      async (request, reply) => {
        const user = currentUser(request)
        const post = await createAdminPost(user, request.body)
        return reply.code(201).send(post)
      },
    )

    // ── PATCH /admin/content/posts/:id ────────────────────────────────────────
    /**
     * Cập nhật nội dung bài viết với OCC bằng updatedAt.
     * Body phải có trường `updatedAt` (ISO string từ lần đọc gần nhất).
     */
    app.patch(
      '/admin/content/posts/:id',
      {
        preHandler: [
          requireManager,
          requireScope(({ id }) =>
            db.post.findUnique({ where: { id }, select: { departmentId: true } }),
          ),
        ],
      },
      async (request) => {
        const user = currentUser(request)
        const { id } = request.params as { id: string }
        return updateAdminPost(user, id, request.body)
      },
    )

    // ── PATCH /admin/content/posts/:id/status ────────────────────────────────
    /**
     * Thay đổi trạng thái bài viết: PUBLISH / UNPUBLISH / ARCHIVE.
     * Ghi audit log trong cùng transaction với thao tác nghiệp vụ.
     * Khi PUBLISH kèm mentionedUserIds: kiểm tra consent PUBLIC_NAME của từng user.
     */
    app.patch(
      '/admin/content/posts/:id/status',
      {
        preHandler: [
          requireManager,
          requireScope(({ id }) =>
            db.post.findUnique({ where: { id }, select: { departmentId: true } }),
          ),
        ],
      },
      async (request, reply) => {
        const user = currentUser(request)
        const { id } = request.params as { id: string }

        try {
          const result = await changePostStatus(request, user, id, request.body)
          return reply.send(result)
        } catch (err: unknown) {
          // Xử lý lỗi missing_consent: trả 400 kèm mảng missingConsentUserIds
          const e = err as Record<string, unknown>
          if (e?.code === 'missing_consent' && Array.isArray(e?.missingConsentUserIds)) {
            return reply.code(400).send({
              error: 'missing_consent',
              message: String(e.message),
              missingConsentUserIds: e.missingConsentUserIds,
            })
          }
          throw err
        }
      },
    )
  }
}

import type { FastifyInstance } from 'fastify'

import { db } from '../../db/client.js'
import { currentUser, requireRole, requireScope } from '../auth/rbac.js'
import {
  createAdminProject,
  getAdminProject,
  listAdminProjects,
  updateAdminProject,
} from './admin-projects.service.js'

export function adminProjectsRoutes() {
  return async function registerAdminProjectsRoutes(app: FastifyInstance) {
    // Tất cả route /admin/content/projects yêu cầu tối thiểu DEPARTMENT_MANAGER hoặc BOARD
    const requireManager = requireRole('DEPARTMENT_MANAGER', 'BOARD')

    // ── GET /admin/content/projects ────────────────────────────────────────────
    /**
     * Danh sách dự án quản trị, lọc theo phạm vi ban người gọi.
     * DEPARTMENT_MANAGER chỉ thấy dự án của ban mình; BOARD thấy tất cả.
     * Filters: status, type, departmentId (tùy chọn).
     */
    app.get(
      '/admin/content/projects',
      { preHandler: requireManager },
      async (request) => {
        const user = currentUser(request)
        return listAdminProjects(user, request.query)
      },
    )

    // ── GET /admin/content/projects/:id ────────────────────────────────────────
    /**
     * Chi tiết dự án quản trị, kèm members và trạng thái consent (chỉ đọc).
     * requireScope đảm bảo 404 nếu dự án không thuộc phạm vi ban người gọi (docs/02 §12.4).
     */
    app.get(
      '/admin/content/projects/:id',
      {
        preHandler: [
          requireManager,
          requireScope(({ id }) =>
            db.project.findUnique({ where: { id }, select: { departmentId: true } }),
          ),
        ],
      },
      async (request) => {
        const user = currentUser(request)
        const { id } = request.params as { id: string }
        return getAdminProject(user, id)
      },
    )

    // ── POST /admin/content/projects ───────────────────────────────────────────
    /**
     * Tạo dự án mới (DRAFT). createdById = người đang đăng nhập.
     * departmentId: MANAGER tự gán ban mình; BOARD chọn (bỏ trống là toàn CLB).
     */
    app.post(
      '/admin/content/projects',
      { preHandler: requireManager },
      async (request, reply) => {
        const user = currentUser(request)
        const project = await createAdminProject(user, request.body)
        return reply.code(201).send(project)
      },
    )

    // ── PATCH /admin/content/projects/:id ──────────────────────────────────────
    /**
     * Cập nhật dự án với OCC bằng updatedAt.
     * Body phải có trường `updatedAt` (ISO string từ lần đọc gần nhất).
     * Đổi title KHÔNG đổi slug (spec C4).
     */
    app.patch(
      '/admin/content/projects/:id',
      {
        preHandler: [
          requireManager,
          requireScope(({ id }) =>
            db.project.findUnique({ where: { id }, select: { departmentId: true } }),
          ),
        ],
      },
      async (request) => {
        const user = currentUser(request)
        const { id } = request.params as { id: string }
        return updateAdminProject(user, id, request.body)
      },
    )
  }
}

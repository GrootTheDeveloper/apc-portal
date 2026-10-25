import type { FastifyInstance, FastifyRequest } from 'fastify'

import type { Role } from '../../db/generated/enums.js'
import { type AppError, forbidden, notFound, unauthenticated } from '../../lib/errors.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult } from '../audit/service.js'
import { SESSION_COOKIE } from './session.js'

// Phân quyền dùng chung cho mọi API (docs/02 mục 12). Không tự viết kiểm quyền riêng trong module.
//
//   app.get('/portal/me', { preHandler: requireAuth }, handler)                        → 401 nếu chưa đăng nhập
//   app.post('/admin/events', { preHandler: requireRole('DEPARTMENT_MANAGER', 'BOARD') }, handler)  → 403 nếu sai vai trò
//   app.get('/admin/events/:id', {
//     preHandler: [
//       requireRole('DEPARTMENT_MANAGER', 'BOARD'),
//       requireScope(({ id }) => db.event.findUnique({ where: { id }, select: { departmentId: true } })),
//     ],
//   }, handler)                                                                           → 404 nếu ngoài phạm vi ban
//
// Trong handler: `const user = currentUser(request)`. Danh sách: `where: { ...departmentScope(user) }`.

/**
 * `roles` luôn có `{ role: 'MEMBER', departmentId: <ban của người dùng> }` (RP-01, MEMBER không lưu trong database),
 * cộng các dòng user_roles đang hiệu lực. Cách tính nằm ở `loadAuthUser` (service.ts).
 */
export type RoleGrant = { role: Role; departmentId: string | null }
export type AuthUser = { id: string; departmentId: string | null; roles: RoleGrant[] }

declare module 'fastify' {
  interface FastifyRequest {
    /** Người đang đăng nhập; null khi chưa có phiên hợp lệ. Gắn ở hook phiên (A2). */
    user: AuthUser | null
  }
}

export function registerAuth(app: FastifyInstance) {
  app.decorateRequest('user', null)
}

/**
 * Request bị từ chối 401/403 ghi audit loại SECURITY / FAILURE (FLOW-20), chờ ghi xong rồi trả lỗi để ném.
 * 401 không kèm cookie phiên chỉ là khách chưa đăng nhập (web hỏi /auth/me mỗi lần mở trang), không phải
 * sự kiện bảo mật nên không ghi, tránh bảng nhật ký phình theo lượt truy cập. Có cookie mà phiên sai/hết hạn thì vẫn ghi.
 * Ghi audit lỗi không được biến 401/403 thành 500: chỉ log kỹ thuật.
 */
async function denied(request: FastifyRequest, error: AppError): Promise<AppError> {
  // Mẫu route (/admin/events/:id), không dùng URL thật vì có thể chứa query string (OPS-11).
  const route = request.routeOptions?.url ?? request.url.split('?')[0] ?? request.url
  request.log.warn({ userId: request.user?.id ?? null, route, status: error.statusCode }, 'auth denied')
  if (error.statusCode === 401 && !request.cookies?.[SESSION_COOKIE]) return error
  await audit(request, {
    action: AUDIT_ACTIONS.AUTH_DENIED,
    targetType: 'ROUTE',
    targetId: route,
    category: AuditCategory.SECURITY,
    result: AuditResult.FAILURE,
    reason: error.message,
    metadata: { status: error.statusCode },
  }).catch((err) => request.log.error({ err }, 'failed to write audit log for denied request'))
  return error
}

/** Người đang đăng nhập, hoặc ghi audit rồi ném 401. Dùng trong preHandler. */
async function authedUser(request: FastifyRequest): Promise<AuthUser> {
  if (!request.user) throw await denied(request, unauthenticated())
  return request.user
}

/** Người đang đăng nhập, hoặc ném 401. Dùng trong handler sau `requireAuth`/`requireRole` (đã chặn và ghi audit ở đó). */
export function currentUser(request: FastifyRequest): AuthUser {
  if (!request.user) throw unauthenticated()
  return request.user
}

export function hasRole(user: AuthUser, role: Role): boolean {
  return user.roles.some((grant) => grant.role === role)
}

/**
 * Người dùng được xem dữ liệu nghiệp vụ thuộc ban này không (docs/02 mục 5, 7):
 * BOARD được toàn câu lạc bộ (ALL); DEPARTMENT_MANAGER chỉ ban mình quản lý (SCOPE);
 * TECH_ADMIN và MEMBER không có quyền nghiệp vụ theo ban. Dữ liệu không thuộc ban nào (null) chỉ BOARD.
 */
export function canAccessDepartment(user: AuthUser, departmentId: string | null): boolean {
  if (hasRole(user, 'BOARD')) return true
  if (departmentId === null) return false
  return user.roles.some((grant) => grant.role === 'DEPARTMENT_MANAGER' && grant.departmentId === departmentId)
}

/** Bộ lọc Prisma cho danh sách theo phạm vi ban — lọc ngay ở database (docs/02 mục 12.2). */
export function departmentScope(user: AuthUser): { departmentId?: { in: string[] } } {
  if (hasRole(user, 'BOARD')) return {}
  const managed = user.roles.flatMap((grant) =>
    grant.role === 'DEPARTMENT_MANAGER' && grant.departmentId !== null ? [grant.departmentId] : [],
  )
  return { departmentId: { in: managed } }
}

/** Ném 404 khi tài nguyên đã tải nằm ngoài phạm vi ban — dùng trong service. */
export function assertInScope(user: AuthUser, departmentId: string | null) {
  if (!canAccessDepartment(user, departmentId)) throw notFound()
}

/** preHandler: bắt buộc đã đăng nhập (401). */
export async function requireAuth(request: FastifyRequest) {
  await authedUser(request)
}

/** preHandler: có ít nhất một trong các vai trò (403). Chưa đăng nhập vẫn là 401. */
export function requireRole(...roles: [Role, ...Role[]]) {
  return async function requireRoleHandler(request: FastifyRequest) {
    const user = await authedUser(request)
    if (!roles.some((role) => hasRole(user, role))) throw await denied(request, forbidden())
  }
}

/**
 * preHandler: tài nguyên trên URL phải thuộc phạm vi ban của người gọi.
 * `load` nhận params của route và trả về `{ departmentId }` của tài nguyên (hoặc null nếu không có).
 * Không tồn tại và ngoài phạm vi đều trả cùng một 404, để không lộ dữ liệu tồn tại (docs/02 mục 12.4).
 */
export function requireScope<K extends string = 'id'>(
  load: (params: Record<K, string>) => Promise<{ departmentId: string | null } | null | undefined>,
) {
  return async function requireScopeHandler(request: FastifyRequest) {
    const user = await authedUser(request)
    const resource = await load(request.params as Record<K, string>)
    if (!resource) throw notFound()
    assertInScope(user, resource.departmentId)
  }
}

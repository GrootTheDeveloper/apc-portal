// Kiểu người dùng đăng nhập trả về từ /auth/login và /auth/me (apps/api/src/modules/auth/service.ts → getMe).
// Web chỉ dùng vai trò để ẩn/hiện menu; API vẫn kiểm tra lại mọi request (docs/02 mục 12.7).

export type Role = 'MEMBER' | 'DEPARTMENT_MANAGER' | 'BOARD' | 'TECH_ADMIN'
/** API luôn trả dòng `{ role: 'MEMBER', departmentId }` cùng các vai trò quản lý đang hiệu lực. */
export type RoleGrant = { role: Role; departmentId: string | null }
export type AccountStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'LOCKED' | 'INACTIVE'

export type Me = {
  id: string
  username: string
  fullName: string
  status: AccountStatus
  departmentId: string | null
  roles: RoleGrant[]
  mustChangePassword: boolean
}

/** Vai trò được vào khu /admin (sitemap PAGE-MGT-01). */
export const ADMIN_ROLES = ['DEPARTMENT_MANAGER', 'BOARD', 'TECH_ADMIN'] as const satisfies readonly Role[]

export function hasRole(user: Me | null, role: Role): boolean {
  return user?.roles.some((grant) => grant.role === role) ?? false
}

export function hasAnyRole(user: Me | null, roles: readonly Role[]): boolean {
  return roles.some((role) => hasRole(user, role))
}

import { hasAnyRole, type Me, type Role } from './auth'

// Menu portal và quản trị theo vai trò — sửa đúng một chỗ này khi thêm trang (A3).
// Route theo docs/04-sitemap.md mục 7, 8; vai trò theo mục 10. Mục chỉ hiện khi người dùng có
// ít nhất một vai trò trong `roles`. Nhóm Hệ thống (/admin/system/*) và Retention (/admin/data-retention)
// không thuộc bản phát hành đầu (PRD mục 13.1) nên không có trong menu.

export type MenuItem = { label: string; to: string; roles: readonly Role[] }

const MANAGER_OR_BOARD = ['DEPARTMENT_MANAGER', 'BOARD'] as const
const BOARD_OR_TECH = ['BOARD', 'TECH_ADMIN'] as const

export const PORTAL_MENU: readonly MenuItem[] = [
  { label: 'Tổng quan', to: '/portal', roles: ['MEMBER'] },
  { label: 'Thông báo', to: '/portal/announcements', roles: ['MEMBER'] },
  { label: 'Sự kiện', to: '/portal/events', roles: ['MEMBER'] },
  { label: 'Tài liệu', to: '/portal/documents', roles: ['MEMBER'] },
  { label: 'Danh bạ', to: '/portal/members', roles: ['MEMBER'] },
  { label: 'Hồ sơ của tôi', to: '/portal/profile', roles: ['MEMBER'] },
  { label: 'Bảo mật tài khoản', to: '/portal/account/security', roles: ['MEMBER'] },
]

export const ADMIN_MENU: readonly MenuItem[] = [
  { label: 'Tổng quan quản trị', to: '/admin', roles: ['DEPARTMENT_MANAGER', 'BOARD', 'TECH_ADMIN'] },
  { label: 'Tuyển thành viên', to: '/admin/recruitment', roles: MANAGER_OR_BOARD },
  { label: 'Thành viên', to: '/admin/members', roles: MANAGER_OR_BOARD },
  { label: 'Tài khoản', to: '/admin/accounts', roles: BOARD_OR_TECH },
  { label: 'Phân quyền', to: '/admin/access-control', roles: BOARD_OR_TECH },
  { label: 'Sự kiện', to: '/admin/events', roles: MANAGER_OR_BOARD },
  { label: 'Bài viết và thông báo', to: '/admin/content/posts', roles: MANAGER_OR_BOARD },
  { label: 'Dự án và sản phẩm', to: '/admin/content/projects', roles: MANAGER_OR_BOARD },
  { label: 'Tài liệu', to: '/admin/documents', roles: MANAGER_OR_BOARD },
  { label: 'Tổ chức', to: '/admin/organization/profile', roles: ['BOARD'] },
  { label: 'Email giao dịch', to: '/admin/email-deliveries', roles: ['DEPARTMENT_MANAGER', 'BOARD', 'TECH_ADMIN'] },
  { label: 'Dữ liệu cá nhân', to: '/admin/data-requests', roles: ['BOARD'] },
  { label: 'Audit log', to: '/admin/audit-logs', roles: BOARD_OR_TECH },
]

export function visibleMenu(menu: readonly MenuItem[], user: Me | null): MenuItem[] {
  return menu.filter((item) => hasAnyRole(user, item.roles))
}

import type { ComponentType } from 'react'

import { hasAnyRole, type Me, type Role } from './auth'

// Menu portal và quản trị — MỘT chỗ khai báo cho cả menu lẫn route (A3).
// Thêm trang: thêm một phần tử vào nhóm phù hợp. Router (src/routes.tsx) tự tạo route, tự chặn theo `roles`,
// và `returnTo` sau đăng nhập tự chấp nhận đường dẫn đó. Chưa có `page` thì route hiện trang "đang xây dựng".
//
//   { label: 'Sự kiện', to: '/admin/events', roles: MANAGER_OR_BOARD,
//     page: () => import('../pages/admin/events/list/AdminEventListPage').then((m) => ({ Component: m.AdminEventListPage })) }
//
// Trang con không nằm trong menu (chi tiết, tạo mới, sửa) khai báo ở `children` của mục cha, cùng quy tắc.
// Route theo docs/04-sitemap.md mục 7 (thành viên), 8 (quản trị); vai trò theo mục 7.1 và 10.
// Nhóm Hệ thống (/admin/system/*) và Retention (/admin/data-retention) không thuộc bản phát hành đầu (PRD §13.1).

export type PageLoader = () => Promise<{ Component: ComponentType }>

export type MenuPage = {
  label: string
  /** đường dẫn đầy đủ, ví dụ `/admin/events/:id` */
  to: string
  /** ai được mở; người khác thấy trang 403 */
  roles: readonly Role[]
  page?: PageLoader
}

export type MenuItem = MenuPage & {
  /** trang con không hiện trên menu, kế thừa nhóm của mục cha trong breadcrumb */
  children?: readonly MenuPage[]
}

export type MenuGroup = { label: string; items: readonly MenuItem[] }

const MEMBER = ['MEMBER'] as const
const ADMIN_AREA = ['DEPARTMENT_MANAGER', 'BOARD', 'TECH_ADMIN'] as const
const MANAGER_OR_BOARD = ['DEPARTMENT_MANAGER', 'BOARD'] as const
const BOARD_OR_TECH = ['BOARD', 'TECH_ADMIN'] as const
const BOARD = ['BOARD'] as const

// Sitemap mục 7.1: điều hướng chính + menu tài khoản.
export const PORTAL_MENU: readonly MenuGroup[] = [
  {
    label: 'Portal',
    items: [
      {
        label: 'Tổng quan',
        to: '/portal',
        roles: MEMBER,
        page: () => import('../pages/portal/home/PortalHomePage').then((m) => ({ Component: m.PortalHomePage })),
      },
      { label: 'Thông báo', to: '/portal/announcements', roles: MEMBER },
      { label: 'Sự kiện', to: '/portal/events', roles: MEMBER },
      { label: 'Tài liệu', to: '/portal/documents', roles: MEMBER },
      { label: 'Thành viên', to: '/portal/members', roles: MEMBER },
    ],
  },
  {
    label: 'Tài khoản',
    items: [
      { label: 'Hồ sơ của tôi', to: '/portal/profile', roles: MEMBER },
      { label: 'Lịch sử hoạt động', to: '/portal/activity-history', roles: MEMBER },
      { label: 'Quyền riêng tư', to: '/portal/privacy', roles: MEMBER },
      { label: 'Dữ liệu cá nhân', to: '/portal/data-requests', roles: MEMBER },
      { label: 'Vai trò và phạm vi của tôi', to: '/portal/account/roles', roles: MEMBER },
      {
        label: 'Bảo mật tài khoản',
        to: '/portal/account/security',
        roles: MEMBER,
        page: () =>
          import('../pages/portal/account/security/SecurityPage').then((m) => ({ Component: m.SecurityPage })),
      },
    ],
  },
]

// Sitemap mục 10: một nhóm chỉ hiện khi người dùng thấy ít nhất một mục con.
export const ADMIN_MENU: readonly MenuGroup[] = [
  {
    label: 'Tổng quan quản trị',
    items: [
      {
        label: 'Tổng quan quản trị',
        to: '/admin',
        roles: ADMIN_AREA,
        page: () => import('../pages/admin/home/AdminHomePage').then((m) => ({ Component: m.AdminHomePage })),
      },
    ],
  },
  {
    label: 'Tuyển thành viên',
    items: [{ label: 'Đợt tuyển', to: '/admin/recruitment', roles: MANAGER_OR_BOARD }],
  },
  {
    label: 'Thành viên',
    items: [
      { label: 'Danh sách thành viên', to: '/admin/members', roles: MANAGER_OR_BOARD },
      { label: 'Nhập từ CSV', to: '/admin/members/import', roles: BOARD },
    ],
  },
  {
    label: 'Tài khoản',
    items: [
      {
        label: 'Tài khoản',
        to: '/admin/accounts',
        roles: BOARD_OR_TECH,
        page: () => import('../pages/admin/accounts/list/AccountListPage').then((m) => ({ Component: m.AccountListPage })),
        children: [
          {
            label: 'Chi tiết tài khoản',
            to: '/admin/accounts/:id',
            roles: BOARD_OR_TECH,
            page: () =>
              import('../pages/admin/accounts/detail/AccountDetailPage').then((m) => ({ Component: m.AccountDetailPage })),
          },
        ],
      },
    ],
  },
  { label: 'Phân quyền', items: [{ label: 'Phân quyền', to: '/admin/access-control', roles: BOARD_OR_TECH }] },
  { label: 'Sự kiện', items: [{ label: 'Sự kiện', to: '/admin/events', roles: MANAGER_OR_BOARD }] },
  {
    label: 'Bài viết và thông báo',
    items: [{ label: 'Bài viết và thông báo', to: '/admin/content/posts', roles: MANAGER_OR_BOARD }],
  },
  {
    label: 'Dự án và sản phẩm',
    items: [{ label: 'Dự án và sản phẩm', to: '/admin/content/projects', roles: MANAGER_OR_BOARD }],
  },
  { label: 'Tài liệu', items: [{ label: 'Tài liệu', to: '/admin/documents', roles: MANAGER_OR_BOARD }] },
  {
    label: 'Tổ chức',
    items: [
      { label: 'Thông tin APC', to: '/admin/organization/profile', roles: BOARD },
      { label: 'Ban chuyên môn', to: '/admin/organization/departments', roles: BOARD },
      { label: 'Nội dung nổi bật', to: '/admin/organization/featured-content', roles: BOARD },
    ],
  },
  {
    label: 'Email giao dịch',
    items: [{ label: 'Email giao dịch', to: '/admin/email-deliveries', roles: ADMIN_AREA }],
  },
  { label: 'Dữ liệu cá nhân', items: [{ label: 'Dữ liệu cá nhân', to: '/admin/data-requests', roles: BOARD }] },
  { label: 'Audit log', items: [{ label: 'Audit log', to: '/admin/audit-logs', roles: BOARD_OR_TECH }] },
]

/** Các nhóm người dùng được thấy, mỗi nhóm chỉ còn mục được thấy; nhóm rỗng bị bỏ. */
export function visibleMenu(menu: readonly MenuGroup[], user: Me | null): MenuGroup[] {
  return menu
    .map((group) => ({ ...group, items: group.items.filter((item) => hasAnyRole(user, item.roles)) }))
    .filter((group) => group.items.length > 0)
}

/** Mọi trang (kể cả trang con) của một menu, kèm nhóm và mục cha để dựng route và breadcrumb. */
export function menuPages(menu: readonly MenuGroup[]) {
  return menu.flatMap((group) =>
    group.items.flatMap((item) => [
      { group, parent: null, page: item },
      ...(item.children ?? []).map((child) => ({ group, parent: item as MenuPage, page: child })),
    ]),
  )
}

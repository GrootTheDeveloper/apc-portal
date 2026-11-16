import { describe, expect, it } from 'vitest'

import { ADMIN_ROLES, hasAnyRole, hasRole, type Me, type RoleGrant } from './auth'
import { ADMIN_MENU, type MenuGroup, menuPages, PORTAL_MENU, visibleMenu } from './menu'

// Giống /auth/me: luôn có MEMBER kèm ban của người dùng.
const person = (roles: RoleGrant[]): Me => ({
  id: 'u',
  username: 'u',
  fullName: 'Người dùng',
  status: 'ACTIVE',
  departmentId: 'dept-a',
  roles: [{ role: 'MEMBER', departmentId: 'dept-a' }, ...roles],
  mustChangePassword: false,
  twoFactor: null,
})

const member = person([])
const manager = person([{ role: 'DEPARTMENT_MANAGER', departmentId: 'dept-a' }])
const board = person([{ role: 'BOARD', departmentId: null }])
const tech = person([{ role: 'TECH_ADMIN', departmentId: null }])
const groups = (user: Me | null, menu: readonly MenuGroup[] = ADMIN_MENU) => visibleMenu(menu, user).map((g) => g.label)
const pages = (user: Me | null) => visibleMenu(ADMIN_MENU, user).flatMap((g) => g.items.map((item) => item.to))

describe('roles', () => {
  it('gives every signed-in account MEMBER and nobody anything when signed out', () => {
    expect(hasRole(member, 'MEMBER')).toBe(true)
    expect(hasRole(null, 'MEMBER')).toBe(false)
    expect(hasAnyRole(member, ADMIN_ROLES)).toBe(false)
    expect(hasAnyRole(manager, ADMIN_ROLES)).toBe(true)
  })
})

describe('portal menu (Sitemap mục 7.1)', () => {
  it('shows the main and account groups to every member', () => {
    for (const user of [member, manager, board, tech]) expect(groups(user, PORTAL_MENU)).toEqual(['Portal', 'Tài khoản'])
    expect(visibleMenu(PORTAL_MENU, null)).toEqual([])
  })
})

describe('admin menu by role (Sitemap mục 10)', () => {
  it('hides every admin group from a plain member', () => {
    expect(groups(member)).toEqual([])
    expect(groups(null)).toEqual([])
  })

  it('shows department managers their scoped groups, not BOARD-only ones', () => {
    expect(groups(manager)).toEqual([
      'Tổng quan quản trị',
      'Tuyển thành viên',
      'Thành viên',
      'Sự kiện',
      'Bài viết và thông báo',
      'Dự án và sản phẩm',
      'Tài liệu',
      'Email giao dịch',
    ])
    for (const boardOnly of ['Tổ chức', 'Tài khoản', 'Phân quyền', 'Dữ liệu cá nhân', 'Audit log']) {
      expect(groups(manager)).not.toContain(boardOnly)
    }
    // Nhóm Thành viên hiện nhưng chỉ mục danh sách; nhập CSV chỉ BOARD.
    expect(pages(manager)).toContain('/admin/members')
    expect(pages(manager)).not.toContain('/admin/members/import')
  })

  it('shows TECH_ADMIN only technical groups', () => {
    expect(groups(tech)).toEqual(['Tổng quan quản trị', 'Tài khoản', 'Phân quyền', 'Email giao dịch', 'Audit log'])
    for (const business of ['Tuyển thành viên', 'Thành viên', 'Sự kiện', 'Bài viết và thông báo', 'Tổ chức']) {
      expect(groups(tech)).not.toContain(business)
    }
  })

  it('shows the board every group, without the post-launch System and Retention pages', () => {
    expect(groups(board)).toEqual(ADMIN_MENU.map((group) => group.label))
    expect(pages(board).some((to) => to.startsWith('/admin/system') || to === '/admin/data-retention')).toBe(false)
  })
})

describe('menu as the single source of pages', () => {
  it('lists every page with its group, including children', () => {
    const extra: MenuGroup[] = [
      {
        label: 'Sự kiện',
        items: [
          {
            label: 'Sự kiện',
            to: '/admin/events',
            roles: ['BOARD'],
            children: [{ label: 'Chi tiết sự kiện', to: '/admin/events/:id', roles: ['BOARD'] }],
          },
        ],
      },
    ]
    expect(menuPages(extra).map(({ page, parent }) => [page.to, parent?.to ?? null])).toEqual([
      ['/admin/events', null],
      ['/admin/events/:id', '/admin/events'],
    ])
  })

  it('has no duplicate paths', () => {
    const all = [...menuPages(PORTAL_MENU), ...menuPages(ADMIN_MENU)].map(({ page }) => page.to)
    expect(new Set(all).size).toBe(all.length)
  })
})

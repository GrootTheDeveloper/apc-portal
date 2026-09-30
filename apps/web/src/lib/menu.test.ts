import { describe, expect, it } from 'vitest'

import { ADMIN_ROLES, hasAnyRole, hasRole, type Me, type RoleGrant } from './auth'
import { ADMIN_MENU, PORTAL_MENU, visibleMenu } from './menu'

const person = (roles: RoleGrant[]): Me => ({
  id: 'u',
  username: 'u',
  fullName: 'Người dùng',
  departmentId: 'dept-a',
  roles,
  mustChangePassword: false,
})

const member = person([])
const manager = person([{ role: 'DEPARTMENT_MANAGER', departmentId: 'dept-a' }])
const board = person([{ role: 'BOARD', departmentId: null }])
const tech = person([{ role: 'TECH_ADMIN', departmentId: null }])
const labels = (user: Me | null) => visibleMenu(ADMIN_MENU, user).map((item) => item.label)

describe('roles', () => {
  it('gives every signed-in account MEMBER and nobody anything when signed out', () => {
    expect(hasRole(member, 'MEMBER')).toBe(true)
    expect(hasRole(null, 'MEMBER')).toBe(false)
    expect(hasAnyRole(member, ADMIN_ROLES)).toBe(false)
    expect(hasAnyRole(manager, ADMIN_ROLES)).toBe(true)
  })
})

describe('menu by role (sitemap mục 10)', () => {
  it('shows the whole portal menu to every member', () => {
    for (const user of [member, manager, board, tech]) expect(visibleMenu(PORTAL_MENU, user)).toHaveLength(PORTAL_MENU.length)
    expect(visibleMenu(PORTAL_MENU, null)).toHaveLength(0)
  })

  it('hides every admin entry from a plain member', () => {
    expect(labels(member)).toEqual([])
    expect(labels(null)).toEqual([])
  })

  it('shows department managers only their scoped business menus', () => {
    expect(labels(manager)).toEqual([
      'Tổng quan quản trị',
      'Tuyển thành viên',
      'Thành viên',
      'Sự kiện',
      'Bài viết và thông báo',
      'Dự án và sản phẩm',
      'Tài liệu',
      'Email giao dịch',
    ])
  })

  it('shows the board every admin menu', () => {
    expect(labels(board)).toEqual(ADMIN_MENU.map((item) => item.label))
  })

  it('keeps TECH_ADMIN out of business data menus', () => {
    const techMenu = labels(tech)
    expect(techMenu).toEqual(['Tổng quan quản trị', 'Tài khoản', 'Phân quyền', 'Lưu giữ dữ liệu', 'Audit log', 'Hệ thống'])
    for (const business of ['Tuyển thành viên', 'Thành viên', 'Sự kiện', 'Tài liệu', 'Dữ liệu cá nhân']) {
      expect(techMenu).not.toContain(business)
    }
  })
})

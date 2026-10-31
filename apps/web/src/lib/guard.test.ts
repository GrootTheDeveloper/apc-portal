import { describe, expect, it } from 'vitest'

import { ADMIN_ROLES, guardRedirect, type Me, type RoleGrant } from './auth'

const person = (overrides: Partial<Me> = {}, roles: RoleGrant[] = []): Me => ({
  id: 'u',
  username: 'u',
  fullName: 'Người dùng',
  status: 'ACTIVE',
  departmentId: null,
  roles: [{ role: 'MEMBER', departmentId: null }, ...roles],
  mustChangePassword: false,
  twoFactor: null,
  ...overrides,
})

describe('guardRedirect — thứ tự kiểm tra Sitemap §11.1', () => {
  it('sends a signed-out visitor to login', () => {
    expect(guardRedirect(null)).toEqual({ action: 'login' })
    expect(guardRedirect(null, { gate: 'activation' })).toEqual({ action: 'login' })
  })

  it('sends a pending or temporary-password account to /account/activate before anything else', () => {
    const pending = person({ status: 'PENDING_ACTIVATION', mustChangePassword: true, twoFactor: 'setup' })
    expect(guardRedirect(pending, { roles: ADMIN_ROLES })).toEqual({ action: 'redirect', to: '/account/activate' })
    expect(guardRedirect(person({ mustChangePassword: true }))).toEqual({ action: 'redirect', to: '/account/activate' })
    // Chính trang kích hoạt thì cho qua.
    expect(guardRedirect(pending, { gate: 'activation' })).toEqual({ action: 'allow' })
  })

  it('then routes privileged accounts to two-factor setup or verification', () => {
    const board = (twoFactor: Me['twoFactor']) => person({ twoFactor }, [{ role: 'BOARD', departmentId: null }])
    expect(guardRedirect(board('setup'), { roles: ADMIN_ROLES })).toEqual({ action: 'redirect', to: '/account/setup-two-factor' })
    expect(guardRedirect(board('verify'), { roles: ADMIN_ROLES })).toEqual({ action: 'redirect', to: '/account/two-factor' })
    expect(guardRedirect(board('setup'), { gate: 'two-factor' })).toEqual({ action: 'allow' })
    expect(guardRedirect(board(null), { roles: ADMIN_ROLES })).toEqual({ action: 'allow' })
  })

  it('then checks the role: a member opening /admin gets 403', () => {
    expect(guardRedirect(person(), { roles: ADMIN_ROLES })).toEqual({ action: 'forbidden' })
    expect(guardRedirect(person())).toEqual({ action: 'allow' })
    expect(guardRedirect(person({}, [{ role: 'DEPARTMENT_MANAGER', departmentId: 'a' }]), { roles: ADMIN_ROLES })).toEqual({ action: 'allow' })
  })
})

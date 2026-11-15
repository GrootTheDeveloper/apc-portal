import { describe, expect, it } from 'vitest'

import type { Me, Role } from '../../../../lib/auth'
import type { ApplicationStatus } from '../../../recruitment/types'
import { canShowConvertButton, getConvertActionState } from './applicationConvertState'

function mockUser(roles: Array<{ role: Role; departmentId?: string | null }>): Me {
  return {
    id: 'user-test',
    username: 'testuser',
    fullName: 'Test User',
    departmentId: null,
    status: 'ACTIVE',
    mustChangePassword: false,
    roles: roles.map((r) => ({ role: r.role, departmentId: r.departmentId ?? null })),
    twoFactor: null,
  }
}

describe('applicationConvertState (R6 Frontend Tests)', () => {
  const boardUser = mockUser([{ role: 'BOARD' }])
  const managerUser = mockUser([{ role: 'DEPARTMENT_MANAGER', departmentId: 'dept-1' }])
  const memberUser = mockUser([{ role: 'MEMBER' }])

  it('Nút "Tạo tài khoản thành viên" hiển thị khi người dùng là BOARD, hồ sơ ACCEPTED và chưa convert', () => {
    const app = { status: 'ACCEPTED' as ApplicationStatus, convertedUserId: null }

    expect(canShowConvertButton(boardUser, app)).toBe(true)
    expect(getConvertActionState(boardUser, app)).toBe('CAN_CONVERT')
  })

  it('Nếu hồ sơ đã chuyển (convertedUserId tồn tại): không hiển thị nút, chuyển sang trạng thái ALREADY_CONVERTED', () => {
    const app = { status: 'ACCEPTED' as ApplicationStatus, convertedUserId: 'user-created-123' }

    expect(canShowConvertButton(boardUser, app)).toBe(false)
    expect(getConvertActionState(boardUser, app)).toBe('ALREADY_CONVERTED')
  })

  it('Nếu người dùng không phải BOARD (ví dụ DEPARTMENT_MANAGER hoặc MEMBER): không hiển thị nút, trả về BOARD_ONLY', () => {
    const app = { status: 'ACCEPTED' as ApplicationStatus, convertedUserId: null }

    // DEPARTMENT_MANAGER
    expect(canShowConvertButton(managerUser, app)).toBe(false)
    expect(getConvertActionState(managerUser, app)).toBe('BOARD_ONLY')

    // MEMBER
    expect(canShowConvertButton(memberUser, app)).toBe(false)
    expect(getConvertActionState(memberUser, app)).toBe('BOARD_ONLY')
  })

  it('Nếu hồ sơ ở các trạng thái khác (NEW, REVIEWING, INTERVIEW, REJECTED, WITHDRAWN): không hiển thị nút, trả về HIDDEN', () => {
    const otherStatuses: ApplicationStatus[] = ['NEW', 'REVIEWING', 'INTERVIEW', 'REJECTED', 'WITHDRAWN']

    for (const status of otherStatuses) {
      const app = { status, convertedUserId: null }
      expect(canShowConvertButton(boardUser, app)).toBe(false)
      expect(getConvertActionState(boardUser, app)).toBe('HIDDEN')
    }
  })

  it('Nếu chưa đăng nhập hoặc hồ sơ chưa tải: không hiển thị nút, trả về HIDDEN', () => {
    expect(canShowConvertButton(null, { status: 'ACCEPTED', convertedUserId: null })).toBe(false)
    expect(getConvertActionState(null, { status: 'ACCEPTED', convertedUserId: null })).toBe('BOARD_ONLY')
    expect(canShowConvertButton(boardUser, null)).toBe(false)
    expect(getConvertActionState(boardUser, null)).toBe('HIDDEN')
  })
})

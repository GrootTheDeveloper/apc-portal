import { describe, expect, it } from 'vitest'

import { formatDirectoryRole, safeAvatarSrc } from './types'

describe('portal member directory helpers', () => {
  it('chỉ nhận URL ảnh đại diện nội bộ/công khai của hệ thống, chặn URL lạ', () => {
    expect(safeAvatarSrc('/api/portal/files/abc123')).toBe('/api/portal/files/abc123')
    expect(safeAvatarSrc('/api/public/files/xyz789')).toBe('/api/public/files/xyz789')
    expect(safeAvatarSrc('javascript:alert(1)')).toBeNull()
    expect(safeAvatarSrc('https://evil.example/track.png')).toBeNull()
    expect(safeAvatarSrc(null)).toBeNull()
  })

  it('hiển thị đúng nhãn vai trò kèm tên ban cho Quản lý ban', () => {
    expect(formatDirectoryRole({ role: 'MEMBER', departmentId: null, department: null })).toBe('Thành viên')
    expect(formatDirectoryRole({ role: 'BOARD', departmentId: null, department: null })).toBe('Ban Chủ nhiệm')
    expect(
      formatDirectoryRole({
        role: 'DEPARTMENT_MANAGER',
        departmentId: 'dept-a',
        department: { id: 'dept-a', name: 'Ban A', code: 'ban-a' },
      }),
    ).toBe('Quản lý ban · Ban A')
  })
})

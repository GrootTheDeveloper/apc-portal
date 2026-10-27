import type { AccountStatus } from '../../../lib/auth'

// Kiểu dữ liệu khớp apps/api/src/modules/accounts/service.ts. BOARD và TECH_ADMIN nhận trường khác nhau
// (Vai trò & quyền §8.2): BOARD thấy thông tin nghiệp vụ, TECH_ADMIN thấy trạng thái kỹ thuật.
export type AccountRow = {
  id: string
  username: string
  fullName: string
  status: AccountStatus
  updatedAt: string
  email?: string
  department?: { id: string; name: string } | null
  failedLoginAttempts?: number
  lockoutUntil?: string | null
  activeSessions?: number
}

export type AccountSession = {
  id: string
  createdAt: string
  lastActiveAt: string
  ipAddress: string | null
  userAgent: string | null
  twoFactorVerified: boolean
}

export type AccountDetail = AccountRow & {
  createdAt: string
  passwordChangedAt?: string | null
  mustChangePassword?: boolean
  isTemporaryPassword?: boolean
  temporaryPasswordExpiresAt?: string | null
  deactivatedAt?: string | null
  roles?: { role: string; status: string; department: { name: string } | null; expiresAt: string | null }[]
  sessions?: AccountSession[]
}

export const STATUS_LABEL: Record<AccountStatus, string> = {
  PENDING_ACTIVATION: 'Chờ kích hoạt',
  ACTIVE: 'Đang hoạt động',
  LOCKED: 'Bị khóa',
  INACTIVE: 'Ngừng hoạt động',
}

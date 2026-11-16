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

// ─── A6: vai trò & phạm vi ────────────────────────────────────────────────

export type ManagedRole = 'DEPARTMENT_MANAGER' | 'BOARD' | 'TECH_ADMIN'
export type RoleStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED'
type Person = { id: string; username: string; fullName: string } | null

export type RoleRow = {
  id: string
  role: ManagedRole
  status: RoleStatus
  startsAt: string
  expiresAt: string | null
  reason: string
  revokedAt: string | null
  revokeReason: string | null
  createdAt: string
  department: { id: string; name: string } | null
  grantedBy: Person
  revokedBy: Person
}

export type RoleDecision = {
  id: string
  action: 'GRANT' | 'REVOKE'
  role: ManagedRole
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED'
  reason: string
  expiresAt: string | null
  createdAt: string
  executedAt: string | null
  user?: Person
  decidedBy: Person
  executedBy: Person
}

export type AccountRoles = {
  user: { id: string; username: string; fullName: string; status: AccountStatus }
  roles: RoleRow[]
  decisions: RoleDecision[]
  termEndsAt: string | null
  departments: { id: string; name: string }[]
}

export const ROLE_LABEL: Record<ManagedRole, string> = {
  DEPARTMENT_MANAGER: 'Quản lý ban',
  BOARD: 'Ban Chủ nhiệm',
  TECH_ADMIN: 'Quản trị viên kỹ thuật',
}

// STATE-14
export const ROLE_STATUS_LABEL: Record<RoleStatus, string> = {
  PENDING: 'Chờ kích hoạt',
  ACTIVE: 'Đang hiệu lực',
  EXPIRED: 'Hết hạn',
  REVOKED: 'Đã thu hồi',
}

/**
 * `location.state` khi mở trang chi tiết từ danh sách: bộ lọc `?q&status&page` để nút quay lại giữ nguyên,
 * và mật khẩu tạm của tài khoản vừa tạo (chỉ đọc một lần rồi xóa khỏi lịch sử).
 */
export type AccountLocationState = {
  listSearch?: string | undefined
  created?: { username: string; temporaryPassword: string } | undefined
}

/** Đường về trang danh sách, giữ bộ lọc cũ nếu có. */
export const listUrl = (listSearch?: string) => `/admin/accounts${listSearch?.startsWith('?') ? listSearch : ''}`

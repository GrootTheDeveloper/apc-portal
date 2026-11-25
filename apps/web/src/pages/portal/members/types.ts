import type { Role } from '../../../lib/auth'

export type DirectoryDepartment = {
  id: string
  name: string
  code: string
}

export type DirectoryRole = {
  role: Role
  departmentId: string | null
  department: DirectoryDepartment | null
}

export type DirectoryMember = {
  id: string
  fullName: string
  avatarUrl: string | null
  department: DirectoryDepartment | null
  roles: DirectoryRole[]
  skills: string[]
  interestAreas: string[]
}

export const DIRECTORY_ROLE_LABEL: Record<Role, string> = {
  MEMBER: 'Thành viên',
  DEPARTMENT_MANAGER: 'Quản lý ban',
  BOARD: 'Ban Chủ nhiệm',
  TECH_ADMIN: 'Quản trị viên kỹ thuật',
}

export function safeAvatarSrc(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null
  if (avatarUrl.startsWith('/api/portal/files/') || avatarUrl.startsWith('/api/public/files/')) {
    return avatarUrl
  }
  return null
}

export function formatDirectoryRole(grant: DirectoryRole): string {
  const label = DIRECTORY_ROLE_LABEL[grant.role] ?? grant.role
  if (grant.role === 'DEPARTMENT_MANAGER' && grant.department) {
    return `${label} · ${grant.department.name}`
  }
  return label
}

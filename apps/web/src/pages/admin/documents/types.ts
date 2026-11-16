export type DocumentRole = 'MEMBER' | 'DEPARTMENT_MANAGER' | 'BOARD' | 'TECH_ADMIN'
export type DocumentItem = {
  id: string
  title: string
  description: string | null
  category: string
  departmentId: string | null
  department: { id: string; name: string; code: string; status: 'ACTIVE' | 'ARCHIVED' } | null
  scope: 'DEPARTMENT' | 'CLUB'
  allowedRoles: DocumentRole[]
  status: 'ACTIVE' | 'ARCHIVED'
  createdAt: string
  updatedAt: string
  currentVersion: {
    id: string
    versionNumber: number
    originalName: string
    mimeType: string
    size: number
    scanStatus: 'PENDING' | 'CLEAN' | 'REJECTED'
    createdAt: string
    uploadedBy: { id: string; fullName: string }
  } | null
}

export type DocumentVersion = {
  id: string
  versionNumber: number
  createdAt: string
  isCurrent: boolean
  storedFile: { originalName: string; mimeType: string; size: number; scanStatus: 'PENDING' | 'CLEAN' | 'REJECTED' }
  uploadedBy: { id: string; fullName: string }
}

export const DOCUMENT_ROLE_LABELS: Record<DocumentRole, string> = {
  MEMBER: 'Thành viên',
  DEPARTMENT_MANAGER: 'Quản lý Ban',
  BOARD: 'Ban Chủ nhiệm',
  TECH_ADMIN: 'Quản trị viên kỹ thuật',
}

export function fileSize(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
}

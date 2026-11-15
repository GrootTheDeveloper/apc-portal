// Kiểu dữ liệu và nhãn cho C4 (quản trị dự án & sản phẩm), khớp apps/api/src/modules/content/admin-projects.service.ts:
// `adminProjectSelect` cho danh sách, `getAdminProject` cho chi tiết/sửa, `changeProjectStatusBody` cho đổi trạng thái.

import { useEffect } from 'react'

export type ProjectType = 'PROJECT' | 'PRODUCT'
export type ProjectStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

/** Hành động đổi trạng thái; API nhận chữ thường (khác C3 bài viết nhận chữ hoa). */
export type ProjectAction = 'publish' | 'unpublish' | 'archive'

export type AdminProjectRow = {
  id: string
  title: string
  slug: string
  description: string
  /** fileId của tệp đã tải lên (D2), không phải URL đầy đủ. */
  thumbnailUrl: string | null
  technologies: string[]
  projectUrl: string | null
  sourceUrl: string | null
  type: ProjectType
  status: ProjectStatus
  /** Ban sở hữu dự án; `null` là dự án toàn CLB do BOARD tạo. */
  departmentId: string | null
  createdById: string
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Thành viên kèm trạng thái đồng ý công bố cho chính dự án này (chỉ đọc). */
export type AdminProjectMember = {
  userId: string
  name: string
  publicNameConsent: boolean
  publicPhotoConsent: boolean
}

export type AdminProjectDetail = AdminProjectRow & {
  members: AdminProjectMember[]
}

/** Một lựa chọn trong ô chọn thành viên: endpoint chỉ trả id + tên, không trả trường nhạy cảm. */
export type ProjectMemberOption = {
  id: string
  fullName: string
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: 'Ẩn',
  PUBLISHED: 'Công khai',
  ARCHIVED: 'Lưu trữ',
}

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  PROJECT: 'Dự án',
  PRODUCT: 'Sản phẩm',
}

export const ACTION_LABEL: Record<ProjectAction, string> = {
  publish: 'Công bố',
  unpublish: 'Gỡ công bố',
  archive: 'Lưu trữ',
}

// Class literal đầy đủ để Tailwind JIT nhận diện (AGENTS.md): không nối chuỗi động từ biến trạng thái.
export const PROJECT_STATUS_BADGE: Record<ProjectStatus, string> = {
  DRAFT: 'bg-apc-gold-pale text-ink',
  PUBLISHED: 'bg-apc-blue-pale text-apc-blue',
  ARCHIVED: 'bg-soft text-muted',
}

const TYPE_CLASS: Record<ProjectType, string> = {
  PROJECT: 'bg-ink text-paper',
  PRODUCT: 'bg-soft text-ink',
}

const BADGE_CLASS = 'inline-flex shrink-0 rounded-full px-3 py-1 text-[14px] font-extrabold'

export const projectStatusBadgeClass = (status: ProjectStatus) => `${BADGE_CLASS} ${PROJECT_STATUS_BADGE[status]}`
export const projectTypeBadgeClass = (type: ProjectType) => `${BADGE_CLASS} ${TYPE_CLASS[type]}`

/** Dấu hiển thị đồng ý công bố: chưa có dữ liệu (vd dự án mới chưa tồn tại) thì là dấu ? */
export function consentMark(known: boolean | undefined): string {
  if (known === undefined) return '?'
  return known ? '✅' : '❌'
}

// Form và body gửi lên API tách khỏi ProjectForm.tsx để file đó chỉ export component (fast-refresh của oxlint).

export type ProjectFormValues = {
  type: ProjectType
  title: string
  description: string
  /** fileId ảnh bìa trả về từ `POST /portal/files`; `null` là không có ảnh. */
  thumbnailUrl: string | null
  technologies: string[]
  projectUrl: string
  sourceUrl: string
  memberIds: string[]
  /** Chỉ BOARD chọn ban; chuỗi rỗng nghĩa là chưa chọn (gửi lên sẽ thành toàn CLB). */
  departmentId: string
}

/** Giá trị khởi tạo của form: từ dự án đang sửa, hoặc rỗng cho dự án mới. */
export function initialProjectValues(project?: AdminProjectDetail | null): ProjectFormValues {
  return {
    type: project?.type ?? 'PROJECT',
    title: project?.title ?? '',
    description: project?.description ?? '',
    thumbnailUrl: project?.thumbnailUrl ?? null,
    technologies: project?.technologies ?? [],
    projectUrl: project?.projectUrl ?? '',
    sourceUrl: project?.sourceUrl ?? '',
    memberIds: project?.members.map((member) => member.userId) ?? [],
    departmentId: project?.departmentId ?? '',
  }
}

/**
 * Body `POST /admin/content/projects` — trường optional để trống thì bỏ hẳn (schema là `.optional()`, gửi null sẽ 422).
 * Manager không gửi departmentId: server tự gán ban đang quản lý.
 */
export function createProjectPayload(values: ProjectFormValues, board: boolean) {
  const projectUrl = values.projectUrl.trim()
  const sourceUrl = values.sourceUrl.trim()
  return {
    type: values.type,
    title: values.title.trim(),
    description: values.description.trim(),
    ...(values.thumbnailUrl ? { thumbnailUrl: values.thumbnailUrl } : {}),
    technologies: values.technologies,
    ...(projectUrl ? { projectUrl } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    memberIds: values.memberIds,
    ...(board && values.departmentId ? { departmentId: values.departmentId } : {}),
  }
}

/**
 * Body `PATCH /admin/content/projects/:id` — `updatedAt` của lần đọc gần nhất để server kiểm tra xung đột (OCC).
 * Link để trống gửi '' (schema không nhận null) → server lưu null. Chỉ BOARD gửi departmentId (kể cả null = toàn CLB).
 */
export function updateProjectPayload(values: ProjectFormValues, updatedAt: string, board: boolean) {
  return {
    type: values.type,
    title: values.title.trim(),
    description: values.description.trim(),
    thumbnailUrl: values.thumbnailUrl,
    technologies: values.technologies,
    projectUrl: values.projectUrl.trim(),
    sourceUrl: values.sourceUrl.trim(),
    memberIds: values.memberIds,
    ...(board ? { departmentId: values.departmentId || null } : {}),
    updatedAt,
  }
}

/**
 * Cảnh báo khi rời trang còn thay đổi chưa lưu (STATE-08): bắt `beforeunload` trong lúc `dirty`.
 * Đặt ở đây (không phải ProjectForm.tsx) để file form chỉ export component (fast-refresh của oxlint).
 */
export function useDirtyFormWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}

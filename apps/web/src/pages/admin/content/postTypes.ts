// Kiểu dữ liệu và nhãn cho C3 (quản trị bài viết), khớp apps/api/src/modules/content/admin-posts.service.ts:
// `adminPostListSelect` cho danh sách, `adminPostDetailSelect` cho chi tiết/sửa, `changeStatusBody` cho đổi trạng thái.

export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type ContentScope = 'PUBLIC' | 'INTERNAL'

/** Trạng thái theo PRD mục 9.2: DRAFT → PUBLISHED → DRAFT, và DRAFT/PUBLISHED → ARCHIVED. */
export type PostAction = 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE'

export type AdminPostRow = {
  id: string
  title: string
  slug: string
  summary: string
  /** fileId của tệp đã tải lên (xem `fileSrc` bên dưới), không phải URL đầy đủ. */
  thumbnailUrl: string | null
  category: string
  scope: ContentScope
  status: ContentStatus
  /** Ban sở hữu bài; `null` là bài toàn CLB do BOARD tạo, chỉ BOARD thấy được. */
  departmentId: string | null
  authorId: string
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AdminPostDetail = AdminPostRow & {
  content: string
  metaTitle: string | null
  metaDescription: string | null
  publishedById: string | null
}

export const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã công bố',
  ARCHIVED: 'Lưu trữ',
}

export const SCOPE_LABEL: Record<ContentScope, string> = {
  PUBLIC: 'Công khai',
  INTERNAL: 'Nội bộ',
}

export const ACTION_LABEL: Record<PostAction, string> = {
  PUBLISH: 'Công bố',
  UNPUBLISH: 'Gỡ để sửa',
  ARCHIVE: 'Lưu trữ',
}

// Class literal đầy đủ để Tailwind JIT nhận diện (AGENTS.md): không nối chuỗi động từ biến trạng thái.
const STATUS_CLASS: Record<ContentStatus, string> = {
  DRAFT: 'bg-apc-gold-pale text-ink',
  PUBLISHED: 'bg-apc-blue-pale text-apc-blue',
  ARCHIVED: 'bg-soft text-muted',
}

const SCOPE_CLASS: Record<ContentScope, string> = {
  PUBLIC: 'bg-ink text-paper',
  INTERNAL: 'bg-soft text-ink',
}

const BADGE_CLASS = 'inline-flex shrink-0 rounded-full px-3 py-1 text-[14px] font-extrabold'

export const statusBadgeClass = (status: ContentStatus) => `${BADGE_CLASS} ${STATUS_CLASS[status]}`
export const scopeBadgeClass = (scope: ContentScope) => `${BADGE_CLASS} ${SCOPE_CLASS[scope]}`

/**
 * Ảnh bài viết: `thumbnailUrl` lưu id tệp trả về từ `POST /portal/files` (D2). Ảnh `CONTENT_IMAGE` do quản lý
 * ban hoặc BOARD tải lên có visibility PUBLIC, nên hiện qua `/public/files/:id` — đi qua tiền tố `/api` như
 * `api(...)` trong src/lib/api.ts.
 */
export const fileSrc = (fileId: string | null) => (fileId ? `/api/public/files/${fileId}` : null)

/** Tên ban cho bài viết; bài không thuộc ban nào (BOARD tạo) là bài toàn CLB. */
export const departmentLabel = (departments: { id: string; name: string }[], departmentId: string | null) =>
  departmentId === null ? 'Toàn CLB' : (departments.find((department) => department.id === departmentId)?.name ?? 'Ban đã ngừng hoạt động')

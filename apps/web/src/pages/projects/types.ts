// Kiểu dữ liệu cho trang dự án công khai (C4), khớp apps/api/src/modules/content/service.ts:
// `projectSelect` trả về cho danh sách lẫn chi tiết, `getPublishedProjectBySlug` gắn thêm `members`.
// Kế thừa ProjectItem của C2 (src/lib/content.ts) để không lệch khi bên API thêm trường.

import type { ProjectItem as BaseProjectItem } from '../../lib/content.js'

export type ProjectType = 'PROJECT' | 'PRODUCT'

/** Mục danh sách dự án công khai: như C2, thêm `type` (P5) cho bộ lọc loại. */
export type ProjectItem = BaseProjectItem & {
  type: ProjectType
}

/**
 * Thành viên hiển thị trên trang chi tiết. API đã lọc sẵn: chỉ trả về thành viên có đồng ý công bố tên
 * (PUBLIC_NAME) cho chính dự án này hoặc toàn CLB — web KHÔNG tự lọc lại.
 */
export type ProjectMember = {
  userId: string
  name: string
  /** Đồng ý công bố ảnh (PUBLIC_PHOTO): true thì ảnh tải từ route avatar, false thì không tải. */
  hasPhoto: boolean
}

export type ProjectDetail = ProjectItem & {
  members: ProjectMember[]
}

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  PROJECT: 'Dự án',
  PRODUCT: 'Sản phẩm',
}

// Class literal đầy đủ để Tailwind JIT nhận diện (AGENTS.md): không nối chuỗi động từ biến.
export const PROJECT_TYPE_BADGE: Record<ProjectType, string> = {
  PROJECT: 'bg-ink text-paper',
  PRODUCT: 'bg-soft text-ink',
}

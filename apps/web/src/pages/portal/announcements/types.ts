// Kiểu dữ liệu cho trang thông báo nội bộ trong portal, khớp GET /portal/announcements và /portal/announcements/:id (C5-P3).

export type PortalAnnouncementItem = {
  id: string
  title: string
  summary: string
  category: string
  /** fileId trong kho tệp (D2), không phải URL hoàn chỉnh */
  thumbnailUrl: string | null
  publishedAt: string | null
  createdAt: string
}

export type PortalAnnouncementDetail = PortalAnnouncementItem & {
  content: string
}

/** Map fileId thành URL public; không gán thẳng thumbnailUrl vào src. */
export const fileSrc = (fileId: string | null): string | null => (fileId ? `/api/public/files/${fileId}` : null)

// Kiểu dữ liệu và hằng số cho trang Sự kiện, khớp GET /public/events, /public/events/:slug (E2).
// Dùng chung cho trang danh sách, lịch, chi tiết và khối sự kiện ở trang chủ.

export type EventStatus = 'PUBLISHED' | 'CANCELLED' | 'ENDED'

export type EventListItem = {
  slug: string
  title: string
  coverImageUrl: string | null
  eventType: string
  status: EventStatus
  startAt: string
  endAt: string
  location: string | null
  onlineUrl: string | null
}

export type EventDetail = EventListItem & {
  id: string
  description: string
  departmentName: string | null
  contactPoint: string | null
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  capacity: number | null
  cancelReason: string | null
}

// eventType lưu tự do trong database, nên danh sách lọc là hằng số giao diện (như NEWS_CATEGORIES).
export const EVENT_TYPES = ['Workshop', 'Training', 'Tech Talk', 'Cuộc thi', 'Hackathon'] as const

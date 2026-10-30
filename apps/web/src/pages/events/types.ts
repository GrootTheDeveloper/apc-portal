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
  allowGuestRegistration: boolean
  cancelReason: string | null
}

// eventType lưu tự do trong database, nên danh sách lọc là hằng số giao diện (như NEWS_CATEGORIES).
export const EVENT_TYPES = ['Workshop', 'Training', 'Tech Talk', 'Cuộc thi', 'Hackathon'] as const

// ─── ĐĂNG KÝ CỦA KHÁCH (E3) ────────────────────────────────────────────────

/** Phản hồi POST /public/events/:slug/registrations: chỉ có mã, hiện một lần trên màn hình (STATE-02). */
export type GuestRegistrationResult = { registrationCode: string }

export type GuestRegistrationStatus = 'REGISTERED' | 'CANCELLED'

/** Phản hồi POST /public/event-registrations/lookup: đăng ký của chính người tra cứu + tóm tắt sự kiện. */
export type RegistrationLookupResult = {
  guestFullName: string | null
  guestEmail: string
  status: GuestRegistrationStatus
  registeredAt: string
  cancelledAt: string | null
  event: {
    slug: string
    title: string
    eventType: string
    status: EventStatus
    startAt: string
    endAt: string
    location: string | null
    onlineUrl: string | null
    cancelReason: string | null
    departmentName: string | null
  }
}

/**
 * Trạng thái đăng ký của khách trên trang công khai (BR-08, EVT-02), dùng chung cho trang chi tiết
 * và trang đăng ký: chỉ khi PUBLISHED, trong thời gian nhận đăng ký và sự kiện cho phép khách.
 */
export function guestRegistrationState(
  event: Pick<EventDetail, 'status' | 'allowGuestRegistration' | 'registrationOpensAt' | 'registrationClosesAt'>,
): 'open' | 'not_open' | 'closed' | 'guests_off' | null {
  if (event.status !== 'PUBLISHED') return null
  if (!event.allowGuestRegistration) return 'guests_off'
  const now = Date.now()
  if (event.registrationOpensAt && now < new Date(event.registrationOpensAt).getTime()) return 'not_open'
  if (event.registrationClosesAt && now > new Date(event.registrationClosesAt).getTime()) return 'closed'
  return 'open'
}

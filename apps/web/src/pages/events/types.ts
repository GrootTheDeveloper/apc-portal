// Kiểu dữ liệu và hằng số cho trang Sự kiện, khớp GET /public/events, /public/events/:slug (E2).
// Dùng chung cho trang danh sách, lịch, chi tiết và khối sự kiện ở trang chủ.

// Trạng thái trả về từ API. ARCHIVED chỉ gặp ở dữ liệu tra cứu/hủy đăng ký — trang công khai đã gỡ
// sự kiện lưu trữ (mở link chi tiết sẽ 404), nên giao diện không tạo liên kết cho trạng thái này.
export type EventStatus = 'PUBLISHED' | 'CANCELLED' | 'ENDED' | 'ARCHIVED'

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

/** Phản hồi POST /public/event-registrations/lookup và POST .../cancel: đăng ký của chính người tra cứu + tóm tắt sự kiện. */
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
    /** Web dùng để ẩn nút hủy khi đã hết hạn hủy (BR-08) */
    registrationClosesAt: string | null
    cancelReason: string | null
    departmentName: string | null
  }
}

/**
 * Trạng thái đăng ký của khách trên trang công khai (BR-08, EVT-02), dùng chung cho trang chi tiết
 * và trang đăng ký: chỉ khi PUBLISHED, chưa qua thời điểm diễn ra, trong thời gian nhận đăng ký và
 * sự kiện cho phép khách.
 */
export function guestRegistrationState(
  event: Pick<EventDetail, 'status' | 'allowGuestRegistration' | 'registrationOpensAt' | 'registrationClosesAt' | 'endAt'>,
): 'open' | 'not_open' | 'closed' | 'guests_off' | null {
  if (event.status !== 'PUBLISHED') return null
  // PUBLISHED đã qua thời điểm diễn ra (tác vụ event-end chưa kịp chuyển trạng thái): coi như đã kết thúc
  if (new Date(event.endAt).getTime() < Date.now()) return null
  if (!event.allowGuestRegistration) return 'guests_off'
  const now = Date.now()
  if (event.registrationOpensAt && now < new Date(event.registrationOpensAt).getTime()) return 'not_open'
  if (event.registrationClosesAt && now > new Date(event.registrationClosesAt).getTime()) return 'closed'
  return 'open'
}

/**
 * Đăng ký còn được hủy không (BR-08): sự kiện vẫn công bố, chưa qua thời điểm diễn ra và còn trong
 * thời hạn hủy — dùng để ẩn nút Hủy đăng ký ở trang tra cứu khi API đã chặn sẵn phía server.
 */
export function cancellationOpen(
  result: Pick<RegistrationLookupResult, 'status'> & {
    event: Pick<RegistrationLookupResult['event'], 'status' | 'endAt' | 'registrationClosesAt'>
  },
): boolean {
  if (result.status !== 'REGISTERED' || result.event.status !== 'PUBLISHED') return false
  const now = Date.now()
  if (now >= new Date(result.event.endAt).getTime()) return false
  return result.event.registrationClosesAt === null || now < new Date(result.event.registrationClosesAt).getTime()
}

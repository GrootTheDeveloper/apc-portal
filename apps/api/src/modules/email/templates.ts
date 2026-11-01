import { db } from '../../db/client.js'

export type RenderedEmail = { subject: string; text: string; html: string }
type Template = (refId: string) => Promise<RenderedEmail | null>

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

/**
 * Mẫu email theo `type` của NotificationDelivery. Mỗi mẫu tự đọc bản ghi gốc theo `refId` lúc gửi
 * (mã hồ sơ, mã đăng ký chỉ lấy ở đây), trả null khi bản ghi gốc không còn. O2 thêm khung chung và mẫu nghiệp vụ.
 */
export const EMAIL_TEMPLATES = {
  /** Email thử cấu hình gửi (POST /admin/email/test); refId là id tài khoản người bấm. */
  TEST: async (userId) => {
    const user = await db.user.findUnique({ where: { id: userId }, select: { fullName: true } })
    if (!user) return null
    const body = 'Đây là email thử từ APC Portal. Nhận được email này nghĩa là cấu hình gửi email đang hoạt động.'
    return {
      subject: 'APC Portal: email thử',
      text: `Xin chào ${user.fullName},\n\n${body}`,
      html: `<p>Xin chào ${escapeHtml(user.fullName)},</p><p>${body}</p>`,
    }
  },

  /**
   * [E4 tạm trước khi O2 merge] Email báo hủy sự kiện cho người còn đăng ký (NTF-01, EVT-09);
   * refId là id sự kiện. Mỗi người nhận một dòng NotificationDelivery riêng, cùng refId.
   */
  EVENT_CANCELLED: async (eventId) => {
    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { title: true, startAt: true, location: true, onlineUrl: true, cancelReason: true },
    })
    if (!event) return null
    // Giờ Việt Nam (BR-14); Node bản chính thức có sẵn ICU đầy đủ nên vi-VN hiển thị đúng.
    const when = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(event.startAt)
    const place = event.location ?? event.onlineUrl ?? 'sẽ được thông báo sau'
    const reason = event.cancelReason ?? ''
    const body = [
      `Sự kiện "${event.title}" đã bị hủy.`,
      `Thời gian dự kiến: ${when}.`,
      reason ? `Lý do: ${reason}` : null,
      `Đăng ký của bạn không cần thao tác gì thêm; dữ liệu đăng ký vẫn được lưu lại.`,
    ]
      .filter((line) => line !== null)
      .join('\n')
    const html = [
      `<p>Sự kiện <strong>${escapeHtml(event.title)}</strong> đã bị hủy.</p>`,
      `<p>Thời gian dự kiến: ${escapeHtml(when)}. Địa điểm: ${escapeHtml(place)}.</p>`,
      reason ? `<p>Lý do: ${escapeHtml(reason)}</p>` : null,
      `<p>Đăng ký của bạn không cần thao tác gì thêm; dữ liệu đăng ký vẫn được lưu lại.</p>`,
    ]
      .filter((line) => line !== null)
      .join('')
    return {
      subject: `APC Portal: sự kiện "${event.title}" đã bị hủy`,
      text: body,
      html,
    }
  },
} satisfies Record<string, Template>

export type EmailType = keyof typeof EMAIL_TEMPLATES

export const EMAIL_TYPES = Object.keys(EMAIL_TEMPLATES) as [EmailType, ...EmailType[]]

export function templateFor(type: string): Template | undefined {
  return Object.hasOwn(EMAIL_TEMPLATES, type) ? EMAIL_TEMPLATES[type as EmailType] : undefined
}

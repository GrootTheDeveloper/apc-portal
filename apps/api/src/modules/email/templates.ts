import { db } from '../../db/client.js'
import { loadConfig } from '../../config.js'
import { formatVnDateTime } from '../../lib/vnTime.js'

export type RenderedEmail = { subject: string; text: string; html: string }
type Template = (refId: string) => Promise<RenderedEmail | null>

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

/** URL do quản trị nhập chỉ nhận http/https (FLOW-18); không đạt thì coi như trực tuyến thuần. */
const safeHttpUrl = (value: string | null) => (value && /^https?:\/\//.test(value) ? value : null)

// Đọc cấu hình đúng một lần khi nạp module (server.ts đã nạp .env trước khi import app);
// không gọi loadConfig() lại trong từng lần render email.
const REGISTRATION_LOOKUP_URL = `${loadConfig().WEB_URL.replace(/\/+$/, '')}/events/registration-lookup`
const APPLICATION_LOOKUP_URL = `${loadConfig().WEB_URL.replace(/\/+$/, '')}/recruitment/application-lookup`
/**
 * Tham chiếu đăng ký của khách đọc theo refId của email; mã đăng ký chỉ lấy ở đây,
 * không truyền qua hàng đợi (FLOW-26, OPS-11). Email tạm của E3 chỉ dành cho khách —
 * E5 (thành viên) sẽ nối mẫu riêng. O2 thay bằng khung email chung sau khi merge.
 */
async function guestRegistrationEmailData(refId: string) {
  const registration = await db.eventRegistration.findUnique({
    where: { id: refId },
    select: {
      registrationCode: true,
      guestFullName: true,
      event: {
        select: { title: true, status: true, startAt: true, endAt: true, location: true, onlineUrl: true },
      },
    },
  })
  // Email tạm của E3 chỉ dành cho khách; dòng thành viên (E5) guestFullName rỗng → trả null.
  if (!registration || registration.guestFullName === null) return null
  return { ...registration, guestFullName: registration.guestFullName }
}

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  NEW: 'Mới nộp',
  REVIEWING: 'Đang xét duyệt',
  INTERVIEW: 'Mời phỏng vấn',
  ACCEPTED: 'Đã chấp nhận',
  REJECTED: 'Không chấp nhận',
  WITHDRAWN: 'Đã rút đơn',
}

/**
 * Mẫu email tạm (E3, trước khi O2 có khung chung): xác nhận và hủy đăng ký sự kiện của khách (NTF-01).
 * Mọi dữ liệu người dùng nhập đều qua escapeHtml trước khi chèn vào HTML.
 */
export const EMAIL_TEMPLATES = {
  /** Xác nhận đăng ký sự kiện của khách; refId là id EventRegistration. */
  EVENT_REGISTRATION_CONFIRMED: async (refId) => {
    const data = await guestRegistrationEmailData(refId)
    if (!data) return null
    const { guestFullName: name, registrationCode: code, event } = data
    const title = event.title
    const time = `${formatVnDateTime(event.startAt)} – ${formatVnDateTime(event.endAt)}`
    const onlineUrl = safeHttpUrl(event.onlineUrl)
    const place = event.location ?? (onlineUrl ? `${onlineUrl} (trực tuyến)` : 'Trực tuyến')
    const lookupUrl = REGISTRATION_LOOKUP_URL
    const subject = `Xác nhận đăng ký sự kiện: ${title}`
    const text = [
      `Xin chào ${name},`,
      `Bạn đã đăng ký thành công sự kiện "${title}" của CLB APC.`,
      `Thời gian: ${time}`,
      `Địa điểm: ${place}`,
      `Mã đăng ký của bạn: ${code}`,
      `Dùng mã kèm email này để tra cứu hoặc hủy đăng ký tại: ${lookupUrl}`,
      'Email gửi tự động, vui lòng không trả lời.',
    ].join('\n')
    const html = [
      `<p>Xin chào ${escapeHtml(name)},</p>`,
      `<p>Bạn đã đăng ký thành công sự kiện <strong>${escapeHtml(title)}</strong> của CLB APC.</p>`,
      `<p>Thời gian: ${escapeHtml(time)}<br>Địa điểm: ${escapeHtml(place)}</p>`,
      `<p>Mã đăng ký của bạn: <strong>${escapeHtml(code)}</strong> — hãy lưu lại để tra cứu hoặc hủy đăng ký tại <a href="${escapeHtml(lookupUrl)}">trang tra cứu đăng ký</a>.</p>`,
      '<p><small>Email gửi tự động, vui lòng không trả lời.</small></p>',
    ].join('\n')
    return { subject, text, html }
  },

  /** Xác nhận hủy đăng ký sự kiện của khách; refId là id EventRegistration. */
  EVENT_REGISTRATION_CANCELLED: async (refId) => {
    const data = await guestRegistrationEmailData(refId)
    if (!data) return null
    const { guestFullName: name, event } = data
    const title = event.title
    const time = formatVnDateTime(event.startAt)
    const subject = `Đã hủy đăng ký sự kiện: ${title}`
    const text = [
      `Xin chào ${name},`,
      `Bạn đã hủy đăng ký sự kiện "${title}" (diễn ra lúc ${time}).`,
      event.status === 'PUBLISHED' ? `Muốn tham gia lại, hãy đăng ký lại trên trang sự kiện trước khi hết hạn.` : 'Vui lòng theo dõi thông báo của CLB APC.',
      'Email gửi tự động, vui lòng không trả lời.',
    ].join('\n')
    const html = [
      `<p>Xin chào ${escapeHtml(name)},</p>`,
      `<p>Bạn đã hủy đăng ký sự kiện <strong>${escapeHtml(title)}</strong> (diễn ra lúc ${escapeHtml(time)}).</p>`,
      event.status === 'PUBLISHED'
        ? '<p>Muốn tham gia lại, hãy đăng ký lại trên trang sự kiện trước khi hết hạn.</p>'
        : '<p>Vui lòng theo dõi thông báo của CLB APC.</p>',
      '<p><small>Email gửi tự động, vui lòng không trả lời.</small></p>',
    ].join('\n')
    return { subject, text, html }
  },

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

  /** Email xác nhận nộp đơn tuyển thành viên (R3, NTF-01) */
  APPLICATION_SUBMITTED: async (applicationId) => {
    const app = await db.membershipApplication.findUnique({
      where: { id: applicationId },
      include: { recruitmentRound: true },
    })
    if (!app) return null

    const applicantName = escapeHtml(app.applicantName)
    const roundTitle = escapeHtml(app.recruitmentRound.title)
    const profileCode = app.profileCode
    const lookupUrl = APPLICATION_LOOKUP_URL

    return {
      subject: `[APC] Xác nhận nộp đơn tuyển: ${app.recruitmentRound.title}`,
      text: `Xin chào ${app.applicantName},\n\nBạn đã nộp đơn ứng tuyển thành công cho đợt tuyển "${app.recruitmentRound.title}".\n\nMã tra cứu hồ sơ của bạn: ${profileCode}\n\nBạn có thể tra cứu trạng thái hồ sơ tại: ${lookupUrl}\n\nTrân trọng,\nCâu lạc bộ Lập trình ứng dụng (APC)`,
      html: `<p>Xin chào <strong>${applicantName}</strong>,</p>
<p>Bạn đã nộp đơn ứng tuyển thành công cho đợt tuyển <strong>${roundTitle}</strong>.</p>
<p>Mã tra cứu hồ sơ của bạn: <strong style="font-size: 18px; color: #C23B22;">${profileCode}</strong></p>
<p>Vui lòng lưu lại mã hồ sơ này để tra cứu kết quả tại: <a href="${escapeHtml(lookupUrl)}">${escapeHtml(lookupUrl)}</a></p>
<p>Trân trọng,<br>Câu lạc bộ Lập trình ứng dụng (APC)</p>`,
    }
  },

  /** Email thông báo cập nhật trạng thái hồ sơ (R4, R5, NTF-01) */
  APPLICATION_STATUS: async (applicationId) => {
    const app = await db.membershipApplication.findUnique({
      where: { id: applicationId },
      include: { recruitmentRound: true },
    })
    if (!app) return null

    const applicantName = escapeHtml(app.applicantName)
    const roundTitle = escapeHtml(app.recruitmentRound.title)
    const statusText = APPLICATION_STATUS_LABELS[app.status] ?? app.status
    const lookupUrl = APPLICATION_LOOKUP_URL

    return {
      subject: `[APC] Cập nhật trạng thái hồ sơ tuyển thành viên: ${app.recruitmentRound.title}`,
      text: `Xin chào ${app.applicantName},\n\nHồ sơ ứng tuyển của bạn cho đợt "${app.recruitmentRound.title}" đã được chuyển sang trạng thái: ${statusText}.\n\nBạn có thể kiểm tra chi tiết tại: ${lookupUrl}\n\nTrân trọng,\nCâu lạc bộ Lập trình ứng dụng (APC)`,
      html: `<p>Xin chào <strong>${applicantName}</strong>,</p>
<p>Hồ sơ ứng tuyển của bạn cho đợt tuyển <strong>${roundTitle}</strong> đã được chuyển sang trạng thái: <strong>${escapeHtml(statusText)}</strong>.</p>
<p>Bạn có thể kiểm tra chi tiết tại: <a href="${escapeHtml(lookupUrl)}">${escapeHtml(lookupUrl)}</a></p>
<p>Trân trọng,<br>Câu lạc bộ Lập trình ứng dụng (APC)</p>`,
    }
  },
} satisfies Record<string, Template>

export type EmailType = keyof typeof EMAIL_TEMPLATES

export const EMAIL_TYPES = Object.keys(EMAIL_TEMPLATES) as [EmailType, ...EmailType[]]

export function templateFor(type: string): Template | undefined {
  return Object.hasOwn(EMAIL_TEMPLATES, type) ? EMAIL_TEMPLATES[type as EmailType] : undefined
}

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

  /** Email xác nhận nộp đơn tuyển thành viên (R3, NTF-01) */
  APPLICATION_SUBMITTED : async (applicationId) => {
    const app = await db.membershipApplication.findUnique({
        where : { id: applicationId},
        include : {recruitmentRound : true},
    })
    if (!app) return null

    const applicantName = escapeHtml(app.applicantName)
    const roundTitle = escapeHtml(app.recruitmentRound.title)
    const profileCode = app.profileCode
    const lookupUrl = '/recruitment/application-lookup'

    return {
      subject : `[APC] Xác nhận nộp đơn tuyển: ${app.recruitmentRound.title}`,
      text: `Xin chào ${app.applicantName},\n\nBạn đã nộp đơn ứng tuyển thành công cho đợt tuyển "${app.recruitmentRound.title}".\n\nMã tra cứu hồ sơ của bạn: ${profileCode}\n\nBạn có thể tra cứu trạng thái hồ sơ tại: ${lookupUrl}\n\nTrân trọng,\nCâu lạc bộ Lập trình ứng dụng (APC)`,
      html: `<p>Xin chào <strong>${applicantName}</strong>,</p>
<p>Bạn đã nộp đơn ứng tuyển thành công cho đợt tuyển <strong>${roundTitle}</strong>.</p>
<p>Mã tra cứu hồ sơ của bạn: <strong style="font-size: 18px; color: #C23B22;">${profileCode}</strong></p>
<p>Vui lòng lưu lại mã hồ sơ này để tra cứu kết quả tại: <a href="${lookupUrl}">${lookupUrl}</a></p>
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
    const statusText = app.status === 'WITHDRAWN' ? 'Đã rút đơn' : app.status
    const lookupUrl = '/recruitment/application-lookup'

    return {
      subject: `[APC] Cập nhật trạng thái hồ sơ tuyển thành viên: ${app.recruitmentRound.title}`,
      text: `Xin chào ${app.applicantName},\n\nHồ sơ ứng tuyển của bạn cho đợt "${app.recruitmentRound.title}" đã được chuyển sang trạng thái: ${statusText}.\n\nBạn có thể kiểm tra chi tiết tại: ${lookupUrl}\n\nTrân trọng,\nCâu lạc bộ Lập trình ứng dụng (APC)`,
      html: `<p>Xin chào <strong>${applicantName}</strong>,</p>
<p>Hồ sơ ứng tuyển của bạn cho đợt tuyển <strong>${roundTitle}</strong> đã được chuyển sang trạng thái: <strong>${statusText}</strong>.</p>
<p>Bạn có thể kiểm tra chi tiết tại: <a href="${lookupUrl}">${lookupUrl}</a></p>
<p>Trân trọng,<br>Câu lạc bộ Lập trình ứng dụng (APC)</p>`,
    }
  },
} satisfies Record<string, Template>

export type EmailType = keyof typeof EMAIL_TEMPLATES

export const EMAIL_TYPES = Object.keys(EMAIL_TEMPLATES) as [EmailType, ...EmailType[]]

export function templateFor(type: string): Template | undefined {
  return Object.hasOwn(EMAIL_TEMPLATES, type) ? EMAIL_TEMPLATES[type as EmailType] : undefined
}

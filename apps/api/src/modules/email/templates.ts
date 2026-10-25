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
} satisfies Record<string, Template>

export type EmailType = keyof typeof EMAIL_TEMPLATES

export const EMAIL_TYPES = Object.keys(EMAIL_TEMPLATES) as [EmailType, ...EmailType[]]

export function templateFor(type: string): Template | undefined {
  return Object.hasOwn(EMAIL_TEMPLATES, type) ? EMAIL_TEMPLATES[type as EmailType] : undefined
}

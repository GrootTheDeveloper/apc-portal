import { z } from 'zod'

import { COMMON_PASSWORDS } from './common-passwords.js'

// Quy tắc mật khẩu mới (SEC-11, FLOW-09 bước 4): 15–128 ký tự, cho phép khoảng trắng và tiếng Việt,
// không bắt buộc trộn loại ký tự. Từ chối mật khẩu phổ biến và mật khẩu trùng tên đăng nhập.
// Trùng mật khẩu tạm / mật khẩu hiện tại cần so với hash nên kiểm ở service (`samePasswordIssue`).

export const PASSWORD_MIN = 15
export const PASSWORD_MAX = 128

const normalize = (value: string) => value.normalize('NFC').toLowerCase().replace(/\s+/g, '')

/** Các điều kiện mật khẩu mới chưa đạt, mỗi điều kiện một câu tiếng Việt (rỗng = đạt). */
export function passwordProblems(password: string, username: string): string[] {
  const problems: string[] = []
  // Đếm theo ký tự (code point) để chữ có dấu, emoji không bị tính thành 2.
  const length = [...password.normalize('NFC')].length
  if (length < PASSWORD_MIN) problems.push(`Mật khẩu phải có ít nhất ${PASSWORD_MIN} ký tự.`)
  if (length > PASSWORD_MAX) problems.push(`Mật khẩu tối đa ${PASSWORD_MAX} ký tự.`)

  const flat = normalize(password)
  if (/^(.{1,4})\1+$/u.test(flat) || COMMON_PASSWORDS.has(flat)) {
    problems.push('Mật khẩu quá phổ biến hoặc dễ đoán. Hãy dùng một cụm từ riêng của bạn.')
  }
  if (username && flat.includes(normalize(username))) problems.push('Mật khẩu không được chứa tên đăng nhập.')
  return problems
}

/** Body đặt mật khẩu mới: nhập 2 lần. Lỗi trả 422 kèm `issues` ghi rõ điều kiện chưa đạt. */
export function newPasswordSchema(username: string) {
  return z
    .object({ newPassword: z.string().max(1024), confirmPassword: z.string().max(1024) })
    .superRefine((value, ctx) => {
      for (const message of passwordProblems(value.newPassword, username)) {
        ctx.addIssue({ code: 'custom', path: ['newPassword'], message })
      }
      if (value.newPassword !== value.confirmPassword) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Mật khẩu nhập lại không khớp.' })
      }
    })
}

/** Lỗi 422 cho một trường, cùng định dạng với lỗi Zod (`src/lib/errors.ts` đổi ZodError → 422). */
export function fieldError(path: string, message: string): z.ZodError {
  return new z.ZodError([{ code: 'custom', path: [path], message, input: undefined }])
}

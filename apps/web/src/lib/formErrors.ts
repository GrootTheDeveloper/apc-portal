import { ApiError } from './api'

/** Gom lỗi 422 của API theo tên trường: `{ newPassword: ['Mật khẩu phải có ít nhất 15 ký tự.'] }`. */
export function fieldErrors(error: unknown): Record<string, string[]> {
  if (!(error instanceof ApiError) || error.status !== 422) return {}
  const result: Record<string, string[]> = {}
  for (const issue of error.issues) {
    if (!issue || typeof issue !== 'object') continue
    const { path, message } = issue as { path?: unknown[]; message?: unknown }
    const field = String(path?.[0] ?? '')
    if (typeof message !== 'string') continue
    result[field] = [...(result[field] ?? []), message]
  }
  return result
}

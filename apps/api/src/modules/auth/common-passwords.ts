import { readFileSync } from 'node:fs'

// Đọc danh sách từ common-passwords.txt nằm cạnh file này. Bản build: `pnpm build` chép file .txt sang dist
// (scripts/copy-assets.mjs). Không gọi dịch vụ ngoài.

/** Chuẩn hóa để so khớp: NFC, chữ thường, bỏ mọi khoảng trắng. Dùng chung cho danh sách và mật khẩu cần kiểm. */
export const flattenPassword = (value: string) => value.normalize('NFC').toLowerCase().replace(/\s+/gu, '')

export const COMMON_PASSWORDS: ReadonlySet<string> = new Set(
  readFileSync(new URL('./common-passwords.txt', import.meta.url), 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map(flattenPassword),
)

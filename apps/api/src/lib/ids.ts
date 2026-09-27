import { randomInt } from 'node:crypto'

// Bỏ 0/O, 1/I/L để người dùng gõ lại không nhầm.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** Mã tra cứu công khai (mã hồ sơ REC-06, mã đăng ký EVT-10): ngẫu nhiên mật mã, không tuần tự. */
export function publicCode(length = 12) {
  return Array.from({ length }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
}

/**
 * "Workshop Git & GitHub cơ bản" → "workshop-git-github-co-ban".
 * Trùng slug thì service tự thêm hậu tố; không dùng từ dành riêng như `registration-lookup` (docs/04 mục 15).
 */
export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

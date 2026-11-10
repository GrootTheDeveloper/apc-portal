import { randomBytes, randomInt } from 'node:crypto'

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

/** Số lần thử thêm hậu tố ngẫu nhiên trước khi bỏ cuộc. */
const SLUG_MAX_ATTEMPTS = 5

/**
 * Sinh slug duy nhất: thử slug gốc trước, nếu đã tồn tại thì thêm hậu tố hex 8 ký tự
 * sinh từ CSPRNG và thử lại, tối đa SLUG_MAX_ATTEMPTS lần.
 * Dùng chung cho Post và Project — không tự viết bản khác.
 */
export async function buildUniqueSlug(
  baseSlug: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (!(await exists(baseSlug))) return baseSlug
  for (let attempt = 0; attempt < SLUG_MAX_ATTEMPTS; attempt += 1) {
    const candidate = `${baseSlug}-${randomBytes(4).toString('hex')}`
    if (!(await exists(candidate))) return candidate
  }
  throw new Error(`Không sinh được slug duy nhất cho "${baseSlug}" sau ${SLUG_MAX_ATTEMPTS} lần thử.`)
}

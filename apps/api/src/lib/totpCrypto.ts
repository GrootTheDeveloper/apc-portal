import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * Tiện ích mã hóa secret TOTP (AES-256-GCM) và băm mã khôi phục (SEC-12, SEC-16).
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function parseKey(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== 32) {
    throw new Error('TOTP_ENCRYPTION_KEY phải là chuỗi hex 64 ký tự (32 bytes).')
  }
  return key
}

/**
 * Mã hóa secret TOTP bằng AES-256-GCM.
 * Định dạng chuỗi trả về: `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 */
export function encryptTotpSecret(secret: string, keyHex: string): string {
  const key = parseKey(keyHex)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Giải mã secret TOTP từ chuỗi `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`.
 */
export function decryptTotpSecret(encryptedString: string, keyHex: string): string {
  const parts = encryptedString.split(':')
  if (parts.length !== 3) {
    throw new Error('Dữ liệu secret TOTP mã hóa không đúng định dạng.')
  }

  const [ivHex, tagHex, cipherHex] = parts
  const key = parseKey(keyHex)
  const iv = Buffer.from(ivHex!, 'hex')
  const authTag = Buffer.from(tagHex!, 'hex')
  const ciphertext = Buffer.from(cipherHex!, 'hex')

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Độ dài IV hoặc AuthTag không hợp lệ.')
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Chuẩn hóa mã khôi phục trước khi băm hoặc so khớp:
 * Chuyển chữ thường, bỏ khoảng trắng và dấu gạch nối.
 */
export function normalizeRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[\s-]/g, '')
}

/**
 * Băm mã khôi phục bằng SHA-256 sau khi chuẩn hóa.
 */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex')
}

/**
 * Sinh 10 mã khôi phục ngẫu nhiên dạng `xxxx-xxxx` (chữ cái và số, loại bỏ ký tự dễ nhầm 0/O, 1/I/l).
 */
export function generateRecoveryCodes(count = 10): string[] {
  // Bảng ký tự an toàn, không chứa ký tự dễ nhầm
  const chars = '23456789abcdefghjkmnpqrstuvwxyz'
  const codes: string[] = []

  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(8)
    let part1 = ''
    let part2 = ''
    for (let j = 0; j < 4; j++) {
      part1 += chars[bytes[j]! % chars.length]
      part2 += chars[bytes[j + 4]! % chars.length]
    }
    codes.push(`${part1}-${part2}`)
  }

  return codes
}

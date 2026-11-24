import { db } from '../src/db/client.js'
import { hashToken } from '../src/modules/auth/session.js'

/**
 * Test đăng nhập BOARD/TECH_ADMIN bằng mật khẩu chỉ nhận phiên chưa qua 2 lớp (B3). Module không kiểm 2 lớp gọi hàm
 * này để coi phiên như đã nhập mã; luồng nhập mã thật được test ở auth/twoFactor.test.ts.
 */
export async function passTwoFactor(token: string) {
  if (token) await db.session.updateMany({ where: { tokenHash: hashToken(token) }, data: { twoFactorVerified: true } })
  return token
}

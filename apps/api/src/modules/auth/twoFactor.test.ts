import { randomUUID } from 'node:crypto'
import * as OTPAuth from 'otpauth'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { hashPassword } from '../../lib/password.js'
import { decryptTotpSecret } from '../../lib/totpCrypto.js'
import { SESSION_COOKIE } from './session.js'

const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const tag = randomUUID().slice(0, 8)
const testPassword = 'mat-khau-chuan-15-ky-tu'

let boardUserId: string
let memberUserId: string

beforeAll(async () => {
  const passwordHash = await hashPassword(testPassword)

  // 1. Tạo tài khoản BOARD có vai trò PENDING (chờ kích hoạt 2FA)
  const boardUser = await db.user.create({
    data: {
      username: `board_${tag}`,
      email: `board_${tag}@apc.test`,
      fullName: 'Trưởng Ban Chủ Nhiệm',
      passwordHash,
      status: 'ACTIVE',
      mustChangePassword: false,
      roles: {
        create: {
          role: 'BOARD',
          status: 'PENDING',
          startsAt: new Date(),
          reason: 'Bổ nhiệm nhiệm kỳ mới',
        },
      },
    },
  })
  boardUserId = boardUser.id

  // 2. Tạo tài khoản MEMBER bình thường
  const memberUser = await db.user.create({
    data: {
      username: `member_${tag}`,
      email: `member_${tag}@apc.test`,
      fullName: 'Thành Viên Bình Thường',
      passwordHash,
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  })
  memberUserId = memberUser.id
})

afterAll(async () => {
  await db.session.deleteMany({ where: { userId: { in: [boardUserId, memberUserId] } } })
  await db.twoFactorRecoveryCode.deleteMany({ where: { userId: { in: [boardUserId, memberUserId] } } })
  await db.userRole.deleteMany({ where: { userId: { in: [boardUserId, memberUserId] } } })
  await db.user.deleteMany({ where: { id: { in: [boardUserId, memberUserId] } } })
})

describe('B3: Xác thực 2 lớp (TOTP & Recovery Codes)', () => {
  let boardCookie: string
  let manualKey: string
  let savedRecoveryCodes: string[] = []

  it('1. Đăng nhập BOARD ban đầu: twoFactorVerified = false, vai trò ở PENDING, chưa gọi được API BOARD', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: config.WEB_URL },
      body: {
        username: `board_${tag}`,
        password: testPassword,
      },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.twoFactorEnabled).toBe(false)
    expect(json.twoFactorVerified).toBe(false)
    expect(json.hasPrivilegedRole).toBe(true)

    // Lấy cookie session
    boardCookie = res.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? ''
    expect(boardCookie).toBeTruthy()

    // Kiểm tra /auth/me: chưa có vai trò BOARD trong roles hiệu lực
    const meRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      cookies: { [SESSION_COOKIE]: boardCookie },
    })
    expect(meRes.statusCode).toBe(200)
    const meJson = meRes.json()
    expect(meJson.roles.some((r: any) => r.role === 'BOARD')).toBe(false)
  })

  it('2. Thiết lập TOTP: nhập mật khẩu nhận QR và manualKey', async () => {
    // Nhập sai mật khẩu -> 401
    const failRes = await app.inject({
      method: 'POST',
      url: '/auth/two-factor/setup',
      headers: { origin: config.WEB_URL },
      cookies: { [SESSION_COOKIE]: boardCookie },
      body: { password: 'sai-mat-khau-ne' },
    })
    expect(failRes.statusCode).toBe(401)

    // Nhập đúng mật khẩu -> 200 kèm QR code data URL và manualKey
    const res = await app.inject({
      method: 'POST',
      url: '/auth/two-factor/setup',
      headers: { origin: config.WEB_URL },
      cookies: { [SESSION_COOKIE]: boardCookie },
      body: { password: testPassword },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(json.manualKey).toBeTruthy()
    manualKey = json.manualKey

    // Kiểm tra DB: secret đã được lưu dạng mã hóa, totpEnabledAt vẫn là null
    const userInDb = await db.user.findUniqueOrThrow({ where: { id: boardUserId } })
    expect(userInDb.totpSecret).toBeTruthy()
    expect(userInDb.totpSecret).not.toBe(manualKey) // Không lưu dạng rõ
    expect(userInDb.totpEnabledAt).toBeNull()

    // Giải mã ra đúng manualKey
    const decrypted = decryptTotpSecret(userInDb.totpSecret!, config.TOTP_ENCRYPTION_KEY)
    expect(decrypted).toBe(manualKey)
  })

  it('3. Xác nhận mã 6 số: kích hoạt 2FA, chuyển vai trò sang ACTIVE, sinh 10 mã khôi phục, thu hồi phiên cũ', async () => {
    const totp = new OTPAuth.TOTP({
      issuer: 'APC Portal',
      label: `board_${tag}`,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(manualKey),
    })

    const validCode = totp.generate()

    // Nhập sai mã 6 số -> 422
    const failRes = await app.inject({
      method: 'POST',
      url: '/auth/two-factor/confirm',
      headers: { origin: config.WEB_URL },
      cookies: { [SESSION_COOKIE]: boardCookie },
      body: { code: '000000' },
    })
    expect(failRes.statusCode).toBe(422)

    // Nhập đúng mã 6 số -> 200, trả về 10 mã khôi phục
    const res = await app.inject({
      method: 'POST',
      url: '/auth/two-factor/confirm',
      headers: { origin: config.WEB_URL },
      cookies: { [SESSION_COOKIE]: boardCookie },
      body: { code: validCode },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.recoveryCodes).toHaveLength(10)
    savedRecoveryCodes = json.recoveryCodes

    // Kiểm tra DB:
    const userInDb = await db.user.findUniqueOrThrow({ where: { id: boardUserId } })
    expect(userInDb.totpEnabledAt).toBeInstanceOf(Date)
    expect(userInDb.totpLastTimeStep).not.toBeNull()

    // Vai trò BOARD đã chuyển sang ACTIVE
    const roleInDb = await db.userRole.findFirstOrThrow({
      where: { userId: boardUserId, role: 'BOARD' },
    })
    expect(roleInDb.status).toBe('ACTIVE')

    // Bảng mã khôi phục có đúng 10 dòng đã băm (không lưu dạng rõ)
    const recoveryRows = await db.twoFactorRecoveryCode.findMany({ where: { userId: boardUserId } })
    expect(recoveryRows).toHaveLength(10)
    for (const row of recoveryRows) {
      expect(savedRecoveryCodes.includes(row.codeHash)).toBe(false) // Phải là hash
    }

    // Phiên cũ đã bị thu hồi -> gọi lại /auth/me nhận 401
    const meRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      cookies: { [SESSION_COOKIE]: boardCookie },
    })
    expect(meRes.statusCode).toBe(401)
  })

  it('4. Đăng nhập lại bằng mã 6 số: đúng mã thì có quyền BOARD; dùng lại cùng mã bị từ chối (chống replay)', async () => {
    // Đăng nhập bước 1 (mật khẩu)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: config.WEB_URL },
      body: { username: `board_${tag}`, password: testPassword },
    })
    expect(loginRes.statusCode).toBe(200)
    const newCookie = loginRes.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? ''

    // Trước khi nhập mã 2FA: chưa có quyền BOARD
    const meBefore = await app.inject({
      method: 'GET',
      url: '/auth/me',
      cookies: { [SESSION_COOKIE]: newCookie },
    })
    expect(meBefore.json().roles.some((r: any) => r.role === 'BOARD')).toBe(false)

    // Xác thực bước 2: sinh mã TOTP ở bước thời gian tiếp theo (tránh trùng time step vừa xác nhận ở test 3)
    const totp = new OTPAuth.TOTP({
      issuer: 'APC Portal',
      label: `board_${tag}`,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(manualKey),
    })
    const validCode = totp.generate({ timestamp: Date.now() + 30_000 })

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/auth/two-factor/verify',
      headers: { origin: config.WEB_URL },
      cookies: { [SESSION_COOKIE]: newCookie },
      body: { code: validCode },
    })
    expect(verifyRes.statusCode).toBe(200)
    expect(verifyRes.json().success).toBe(true)

    // Sau khi nhập mã: có quyền BOARD đầy đủ!
    const meAfter = await app.inject({
      method: 'GET',
      url: '/auth/me',
      cookies: { [SESSION_COOKIE]: newCookie },
    })
    expect(meAfter.json().roles.some((r: any) => r.role === 'BOARD')).toBe(true)
    expect(meAfter.json().twoFactorVerified).toBe(true)

    // Dùng lại CÙNG MÃ 6 SỐ đó lần thứ 2: bị từ chối chống replay (401)
    const replayRes = await app.inject({
      method: 'POST',
      url: '/auth/two-factor/verify',
      headers: { origin: config.WEB_URL },
      cookies: { [SESSION_COOKIE]: newCookie },
      body: { code: validCode },
    })
    expect(replayRes.statusCode).toBe(401)
  })

  it('5. Đăng nhập bằng mã khôi phục một lần: đúng mã thì thành công; dùng lại lần 2 bị từ chối', async () => {
    // Đăng nhập bước 1
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: config.WEB_URL },
      body: { username: `board_${tag}`, password: testPassword },
    })
    const sessionCookie = loginRes.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? ''

    const testRecoveryCode = savedRecoveryCodes[0]!

    // Dùng mã khôi phục để xác thực
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/auth/two-factor/verify',
      headers: { origin: config.WEB_URL },
      cookies: { [SESSION_COOKIE]: sessionCookie },
      body: { code: testRecoveryCode },
    })
    expect(verifyRes.statusCode).toBe(200)
    expect(verifyRes.json().method).toBe('recovery_code')
    expect(verifyRes.json().requireRegenerate).toBe(true)

    // Sau khi dùng: phiên có quyền BOARD
    const meRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      cookies: { [SESSION_COOKIE]: sessionCookie },
    })
    expect(meRes.json().twoFactorVerified).toBe(true)

    // Dùng lại mã khôi phục đã qua sử dụng trên phiên khác: BỊ TỪ CHỐI
    const loginRes2 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: config.WEB_URL },
      body: { username: `board_${tag}`, password: testPassword },
    })
    const sessionCookie2 = loginRes2.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? ''

    const reuseRes = await app.inject({
      method: 'POST',
      url: '/auth/two-factor/verify',
      headers: { origin: config.WEB_URL },
      cookies: { [SESSION_COOKIE]: sessionCookie2 },
      body: { code: testRecoveryCode },
    })
    expect(reuseRes.statusCode).toBe(401)
  })

  it('6. Tạo lại bộ mã khôi phục: nhập mật khẩu -> sinh 10 mã mới, mã cũ không còn dùng được', async () => {
    // Đăng nhập có 2FA
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: config.WEB_URL },
      body: { username: `board_${tag}`, password: testPassword },
    })
    const sessionCookie = loginRes.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? ''

    // Dùng mã khôi phục thứ 2 để đăng nhập
    await app.inject({
      method: 'POST',
      url: '/auth/two-factor/verify',
      headers: { origin: config.WEB_URL },
      cookies: { [SESSION_COOKIE]: sessionCookie },
      body: { code: savedRecoveryCodes[1]! },
    })

    // Yêu cầu tạo lại bộ mã mới
    const regenRes = await app.inject({
      method: 'POST',
      url: '/auth/two-factor/recovery-codes',
      headers: { origin: config.WEB_URL },
      cookies: { [SESSION_COOKIE]: sessionCookie },
      body: { password: testPassword },
    })

    expect(regenRes.statusCode).toBe(200)
    const newCodes = regenRes.json().recoveryCodes
    expect(newCodes).toHaveLength(10)
    expect(newCodes).not.toEqual(savedRecoveryCodes)
  })

  it('7. Thành viên MEMBER thông thường đăng nhập không bị ép nhập TOTP', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: config.WEB_URL },
      body: { username: `member_${tag}`, password: testPassword },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.twoFactorEnabled).toBe(false)
    expect(json.hasPrivilegedRole).toBe(false)
    // Tài khoản member vẫn có vai trò MEMBER và dùng bình thường
    expect(json.roles.some((r: any) => r.role === 'MEMBER')).toBe(true)
  })
})

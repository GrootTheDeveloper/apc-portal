import type { FastifyRequest } from 'fastify'
import * as OTPAuth from 'otpauth'
import qrcode from 'qrcode'
import { z } from 'zod'

import type { AppConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { conflict } from '../../lib/errors.js'
import { verifyPassword } from '../../lib/password.js'
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
} from '../../lib/totpCrypto.js'
import { audit, AUDIT_ACTIONS, AuditCategory, AuditResult } from '../audit/service.js'
import { fieldError } from './password-policy.js'
import { markSessionTwoFactorVerified } from './session.js'

export const setupTwoFactorSchema = z.object({
  password: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.').max(1024),
})

export const confirmTwoFactorSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Mã xác thực phải gồm 6 chữ số.'),
})

export const verifyTwoFactorSchema = z.object({
  code: z.string().trim().min(6, 'Vui lòng nhập mã xác thực hoặc mã khôi phục.').max(32),
})

/**
 * Bước 1: Xác minh lại mật khẩu và khởi tạo secret TOTP cùng mã QR (FLOW-27).
 */
export async function initiateTwoFactorSetup(
  userId: string,
  password: string,
  config: AppConfig,
) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, username: true, passwordHash: true, totpEnabledAt: true },
  })

  if (user.totpEnabledAt) {
    throw conflict('TOTP đã được kích hoạt, không thể thiết lập lại.')
  }
  const passwordValid = await verifyPassword(user.passwordHash, password)
  if (!passwordValid) {
    throw fieldError('password', 'Mật khẩu không chính xác.')
  }

  // Sinh secret mới ngẫu nhiên bằng CSPRNG
  const secretInstance = new OTPAuth.Secret({ size: 20 })
  const base32Secret = secretInstance.base32

  const totp = new OTPAuth.TOTP({
    issuer: 'APC Portal',
    label: user.username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secretInstance,
  })

  const otpauthUri = totp.toString()
  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUri, {
    margin: 2,
    width: 256,
  })

  // Lưu secret đã mã hóa tạm thời (chưa kích hoạt vì totpEnabledAt vẫn là null)
  const encryptedSecret = encryptTotpSecret(base32Secret, config.TOTP_ENCRYPTION_KEY)
  await db.user.update({
    where: { id: userId },
    data: {
      totpSecret: encryptedSecret,
      totpEnabledAt: null, // Chưa bật chính thức cho đến khi xác nhận mã
    },
  })

  return {
    qrCodeDataUrl,
    manualKey: base32Secret,
  }
}

/**
 * Bước 2: Xác nhận mã 6 số đầu tiên -> Kích hoạt 2FA, sinh 10 mã khôi phục (FLOW-27).
 */
export async function confirmTwoFactorSetup(
  userId: string,
  sessionId: string,
  code: string,
  config: AppConfig,
  request: FastifyRequest,
) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, username: true, totpSecret: true, totpEnabledAt: true },
  })

  if (!user.totpSecret || user.totpEnabledAt) {
    throw conflict('Yêu cầu thiết lập không hợp lệ hoặc 2FA đã được kích hoạt trước đó.')
  }

  const base32Secret = decryptTotpSecret(user.totpSecret, config.TOTP_ENCRYPTION_KEY)
  const totp = new OTPAuth.TOTP({
    issuer: 'APC Portal',
    label: user.username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  })

  const delta = totp.validate({ token: code, window: 1 })
  if (delta === null) {
    throw fieldError('code', 'Mã xác thực 6 số không chính xác hoặc đã hết hạn.')
  }

  const timeStep = BigInt(Math.floor(Date.now() / 1000 / 30) + delta)
  const recoveryCodes = generateRecoveryCodes(10)

  await db.$transaction(async (tx) => {
    // 1. Kích hoạt TOTP trên tài khoản
    await tx.user.update({
      where: { id: userId },
      data: {
        totpEnabledAt: new Date(),
        totpLastTimeStep: timeStep,
      },
    })

    // 2. Lưu hash của 10 mã khôi phục
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } })
    for (const rawCode of recoveryCodes) {
      await tx.twoFactorRecoveryCode.create({
        data: {
          userId,
          codeHash: hashRecoveryCode(rawCode, config.TOTP_ENCRYPTION_KEY),
        },
      })
    }

    // 3. Chuyển vai trò đặc quyền (BOARD, TECH_ADMIN) từ PENDING sang ACTIVE (RP-13, FLOW-27)
    await tx.userRole.updateMany({
      where: {
        userId,
        role: { in: ['BOARD', 'TECH_ADMIN'] },
        status: 'PENDING',
      },
      data: {
        status: 'ACTIVE',
      },
    })

    // 4. Thu hồi các phiên khác; phiên đang thao tác vừa chứng minh có mã đúng nên coi như đã qua 2 lớp
    await tx.session.updateMany({
      where: { userId, revokedAt: null, id: { not: sessionId } },
      data: { revokedAt: new Date() },
    })
    await markSessionTwoFactorVerified(sessionId, tx)

    // 5. Ghi nhật ký thao tác
    await audit(
      request,
      {
        action: AUDIT_ACTIONS.AUTH_TWO_FACTOR_SETUP,
        targetType: 'USER',
        targetId: userId,
        category: AuditCategory.SECURITY,
        result: AuditResult.SUCCESS,
        reason: 'Thiết lập xác thực 2 lớp TOTP thành công',
      },
      tx,
    )
  })

  // Trả về danh sách 10 mã khôi phục dạng rõ (chỉ hiển thị một lần duy nhất)
  return { recoveryCodes }
}

/**
 * Xác thực 2 lớp khi đăng nhập: nhận mã TOTP 6 số hoặc mã khôi phục. Sai mã trả 422 gắn vào ô `code`, không trả
 * 401: web coi mọi 401 là phiên đã hết và đưa về trang đăng nhập.
 */
export async function verifyTwoFactorChallenge(
  sessionId: string,
  userId: string,
  codeOrRecovery: string,
  config: AppConfig,
  request: FastifyRequest,
) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      totpSecret: true,
      totpEnabledAt: true,
      totpLastTimeStep: true,
    },
  })

  if (!user.totpSecret || !user.totpEnabledAt) {
    throw conflict('Tài khoản chưa kích hoạt xác thực 2 lớp.')
  }

  const trimmed = codeOrRecovery.trim()
  const isSixDigitOtp = /^\d{6}$/.test(trimmed)

  if (isSixDigitOtp) {
    // Xác thực mã 6 số TOTP
    const base32Secret = decryptTotpSecret(user.totpSecret, config.TOTP_ENCRYPTION_KEY)
    const totp = new OTPAuth.TOTP({
      issuer: 'APC Portal',
      label: user.username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(base32Secret),
    })

    const delta = totp.validate({ token: trimmed, window: 1 })
    if (delta === null) {
      await audit(request, {
        action: AUDIT_ACTIONS.AUTH_TWO_FACTOR_VERIFY,
        targetType: 'USER',
        targetId: userId,
        category: AuditCategory.SECURITY,
        result: AuditResult.FAILURE,
        reason: 'Mã TOTP 6 số không hợp lệ',
      })
      throw fieldError('code', 'Mã xác thực 6 số không chính xác.')
    }

    const timeStep = BigInt(Math.floor(Date.now() / 1000 / 30) + delta)
    // Ghi có điều kiện: hai request cùng một mã chạy song song thì chỉ một request cập nhật được (chống replay).
    const claimed = await db.user.updateMany({
      where: { id: userId, OR: [{ totpLastTimeStep: null }, { totpLastTimeStep: { lt: timeStep } }] },
      data: { totpLastTimeStep: timeStep },
    })
    if (claimed.count === 0) {
      await audit(request, {
        action: AUDIT_ACTIONS.AUTH_TWO_FACTOR_VERIFY,
        targetType: 'USER',
        targetId: userId,
        category: AuditCategory.SECURITY,
        result: AuditResult.FAILURE,
        reason: 'Mã TOTP đã được sử dụng trước đó (chống replay)',
      })
      throw fieldError('code', 'Mã xác thực đã được sử dụng. Vui lòng chờ mã kế tiếp.')
    }

    await markSessionTwoFactorVerified(sessionId)

    await audit(request, {
      action: AUDIT_ACTIONS.AUTH_TWO_FACTOR_VERIFY,
      targetType: 'USER',
      targetId: userId,
      category: AuditCategory.SECURITY,
      result: AuditResult.SUCCESS,
      reason: 'Xác thực TOTP 6 số thành công',
    })

    return { success: true, method: 'totp', requireRegenerate: false }
  }

  // Xác thực bằng mã khôi phục (Recovery Code)
  const usedAt = new Date()
  const used = await db.twoFactorRecoveryCode.updateMany({
    where: { userId, codeHash: hashRecoveryCode(trimmed, config.TOTP_ENCRYPTION_KEY), usedAt: null },
    data: { usedAt },
  })

  if (used.count === 0) {
    await audit(request, {
      action: AUDIT_ACTIONS.AUTH_TWO_FACTOR_VERIFY,
      targetType: 'USER',
      targetId: userId,
      category: AuditCategory.SECURITY,
      result: AuditResult.FAILURE,
      reason: 'Mã khôi phục không hợp lệ hoặc đã sử dụng',
    })
    throw fieldError('code', 'Mã khôi phục không hợp lệ hoặc đã qua sử dụng.')
  }

  // FLOW-27: dùng mã khôi phục xong bắt buộc tạo bộ mới, nên bộ cũ hết hiệu lực luôn; /auth/me trả `regenerate`.
  await db.twoFactorRecoveryCode.updateMany({ where: { userId, usedAt: null }, data: { usedAt } })
  await markSessionTwoFactorVerified(sessionId)

  await audit(request, {
    action: AUDIT_ACTIONS.AUTH_TWO_FACTOR_VERIFY,
    targetType: 'USER',
    targetId: userId,
    category: AuditCategory.SECURITY,
    result: AuditResult.SUCCESS,
    reason: 'Đăng nhập thành công bằng mã khôi phục một lần',
  })

  // Theo FLOW-27: Sử dụng mã khôi phục xong bắt buộc phải tạo lại bộ mã mới
  return { success: true, method: 'recovery_code', requireRegenerate: true }
}

/**
 * Tạo lại 10 mã khôi phục mới (yêu cầu nhập lại mật khẩu) (FLOW-27).
 */
export async function regenerateRecoveryCodes(
  userId: string,
  password: string,
  config: AppConfig,
  request: FastifyRequest,
) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, passwordHash: true, totpEnabledAt: true },
  })

  if (!user.totpEnabledAt) {
    throw conflict('Tài khoản chưa bật xác thực 2 lớp.')
  }

  const passwordValid = await verifyPassword(user.passwordHash, password)
  if (!passwordValid) {
    throw fieldError('password', 'Mật khẩu không chính xác.')
  }

  const newCodes = generateRecoveryCodes(10)

  await db.$transaction(async (tx) => {
    // Xóa bộ mã cũ và tạo bộ mã mới
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } })
    for (const rawCode of newCodes) {
      await tx.twoFactorRecoveryCode.create({
        data: {
          userId,
          codeHash: hashRecoveryCode(rawCode, config.TOTP_ENCRYPTION_KEY),
        },
      })
    }

    await audit(
      request,
      {
        action: AUDIT_ACTIONS.AUTH_TWO_FACTOR_RESET,
        targetType: 'USER',
        targetId: userId,
        category: AuditCategory.SECURITY,
        result: AuditResult.SUCCESS,
        reason: 'Tạo lại bộ 10 mã khôi phục mới',
      },
      tx,
    )
  })

  return { recoveryCodes: newCodes }
}

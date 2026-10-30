import type { FastifyRequest } from 'fastify'
import * as OTPAuth from 'otpauth'
import qrcode from 'qrcode'
import { z } from 'zod'

import type { AppConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { conflict, unauthenticated, validation } from '../../lib/errors.js'
import { verifyPassword } from '../../lib/password.js'
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
} from '../../lib/totpCrypto.js'
import { audit, AUDIT_ACTIONS, AuditCategory, AuditResult } from '../audit/service.js'
import { markSessionTwoFactorVerified } from './session.js'

export const setupTwoFactorSchema = z.object({
  password: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
})

export const confirmTwoFactorSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Mã xác thực phải gồm 6 chữ số.'),
})

export const verifyTwoFactorSchema = z.object({
  code: z.string().trim().min(6, 'Vui lòng nhập mã xác thực hoặc mã khôi phục.'),
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

  const passwordValid = await verifyPassword(user.passwordHash, password)
  if (!passwordValid) {
    throw unauthenticated('Mật khẩu không chính xác.')
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
    throw validation('Mã xác thực 6 số không chính xác hoặc đã hết hạn.')
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
          codeHash: hashRecoveryCode(rawCode),
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

    // 4. Thu hồi mọi phiên đăng nhập cũ, yêu cầu đăng nhập lại
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })

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
 * Xác thực 2 lớp khi đăng nhập: nhận mã TOTP 6 số hoặc mã khôi phục.
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
      throw unauthenticated('Mã xác thực 6 số không chính xác.')
    }

    const timeStep = BigInt(Math.floor(Date.now() / 1000 / 30) + delta)
    if (user.totpLastTimeStep !== null && timeStep <= user.totpLastTimeStep) {
      await audit(request, {
        action: AUDIT_ACTIONS.AUTH_TWO_FACTOR_VERIFY,
        targetType: 'USER',
        targetId: userId,
        category: AuditCategory.SECURITY,
        result: AuditResult.FAILURE,
        reason: 'Mã TOTP đã được sử dụng trước đó (chống replay)',
      })
      throw unauthenticated('Mã xác thực đã được sử dụng. Vui lòng chờ mã kế tiếp.')
    }

    // Cập nhật timeStep và đánh dấu phiên đã xác thực 2 lớp
    await db.user.update({
      where: { id: userId },
      data: { totpLastTimeStep: timeStep },
    })
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
  const hashedInput = hashRecoveryCode(trimmed)
  const recoveryRow = await db.twoFactorRecoveryCode.findFirst({
    where: {
      userId,
      codeHash: hashedInput,
      usedAt: null,
    },
  })

  if (!recoveryRow) {
    await audit(request, {
      action: AUDIT_ACTIONS.AUTH_TWO_FACTOR_VERIFY,
      targetType: 'USER',
      targetId: userId,
      category: AuditCategory.SECURITY,
      result: AuditResult.FAILURE,
      reason: 'Mã khôi phục không hợp lệ hoặc đã sử dụng',
    })
    throw unauthenticated('Mã khôi phục không hợp lệ hoặc đã qua sử dụng.')
  }

  // Đánh dấu mã đã dùng và bật quyền phiên
  await db.twoFactorRecoveryCode.update({
    where: { id: recoveryRow.id },
    data: { usedAt: new Date() },
  })
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
    throw unauthenticated('Mật khẩu không chính xác.')
  }

  const newCodes = generateRecoveryCodes(10)

  await db.$transaction(async (tx) => {
    // Xóa bộ mã cũ và tạo bộ mã mới
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } })
    for (const rawCode of newCodes) {
      await tx.twoFactorRecoveryCode.create({
        data: {
          userId,
          codeHash: hashRecoveryCode(rawCode),
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

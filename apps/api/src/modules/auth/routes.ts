import type { FastifyInstance } from 'fastify'

import type { AppConfig } from '../../config.js'
import { unauthenticated } from '../../lib/errors.js'
import { currentUser, requireAuth } from './rbac.js'
import { getMe, loadAuthUser, loginSchema, verifyLogin } from './service.js'
import {
  clearSessionCookie,
  createSession,
  revokeSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from './session.js'
import {
  confirmTwoFactorSchema,
  confirmTwoFactorSetup,
  initiateTwoFactorSetup,
  regenerateRecoveryCodes,
  setupTwoFactorSchema,
  verifyTwoFactorChallenge,
  verifyTwoFactorSchema,
} from './twoFactorService.js'

export function authRoutes(config: AppConfig) {
  return async function registerAuthRoutes(app: FastifyInstance) {
    // Giới hạn thô theo IP (SEC-05); khóa 15 phút sau 5 lần sai theo tài khoản nằm trong verifyLogin.
    app.post(
      '/auth/login',
      { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
      async (request, reply) => {
        const input = loginSchema.parse(request.body)
        const userId = await verifyLogin(input)

        // Đăng nhập lại trên cùng trình duyệt: bỏ phiên cũ trước khi cấp phiên mới.
        if (request.sessionId) await revokeSession(request.sessionId)
        const token = await createSession(userId, {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        })
        reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions(config))

        // Phiên mới khởi tạo chưa qua bước 2FA (twoFactorVerified = false)
        const user = await loadAuthUser(userId, { twoFactorVerified: false })
        if (!user) throw unauthenticated()

        // Tìm sessionId vừa tạo từ cookie token
        const { findActiveSession } = await import('./session.js')
        const session = await findActiveSession(token)

        return getMe(user, session?.id)
      },
    )

    app.post('/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
      if (request.sessionId) await revokeSession(request.sessionId)
      clearSessionCookie(reply, config)
      return reply.code(204).send()
    })

    app.get('/auth/me', { preHandler: requireAuth }, async (request) => {
      const user = currentUser(request)
      return getMe(user, request.sessionId)
    })

    // ─────────────────────────────────────────────────────────────────────────
    // XÁC THỰC 2 LỚP (TOTP) — B3
    // ─────────────────────────────────────────────────────────────────────────

    /** Bước 1: Xác minh lại mật khẩu và khởi tạo mã QR / khóa nhập tay */
    app.post(
      '/auth/two-factor/setup',
      { preHandler: requireAuth },
      async (request) => {
        const user = currentUser(request)
        const input = setupTwoFactorSchema.parse(request.body)
        return initiateTwoFactorSetup(user.id, input.password, config)
      },
    )

    /** Bước 2: Xác nhận mã 6 số đầu tiên -> kích hoạt 2FA, sinh 10 mã khôi phục */
    app.post(
      '/auth/two-factor/confirm',
      { preHandler: requireAuth },
      async (request) => {
        const user = currentUser(request)
        const input = confirmTwoFactorSchema.parse(request.body)
        return confirmTwoFactorSetup(user.id, input.code, config, request)
      },
    )

    /** Xác thực bước 2 khi đăng nhập: nhận mã 6 số hoặc 1 mã khôi phục */
    app.post(
      '/auth/two-factor/verify',
      {
        preHandler: requireAuth,
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      },
      async (request) => {
        const user = currentUser(request)
        const input = verifyTwoFactorSchema.parse(request.body)
        if (!request.sessionId) throw unauthenticated()

        return verifyTwoFactorChallenge(
          request.sessionId,
          user.id,
          input.code,
          config,
          request,
        )
      },
    )

    /** Tạo lại 10 mã khôi phục mới (yêu cầu mật khẩu) */
    app.post(
      '/auth/two-factor/recovery-codes',
      { preHandler: requireAuth },
      async (request) => {
        const user = currentUser(request)
        const input = setupTwoFactorSchema.parse(request.body)
        return regenerateRecoveryCodes(user.id, input.password, request)
      },
    )
  }
}

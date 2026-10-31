import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import type { AppConfig } from '../../config.js'
import { unauthenticated } from '../../lib/errors.js'
import { currentUser, requireAuth, requireSession } from './rbac.js'
import { activateAccount, changePassword, getMe, loadAuthUser, loginSchema, verifyLogin } from './service.js'
import { clearSessionCookie, createSession, hashToken, revokeSession, SESSION_COOKIE, sessionCookieOptions } from './session.js'

// Đổi mật khẩu cần đúng mật khẩu hiện tại: giới hạn để không dò được (SEC-05). Đếm theo PHIÊN (băm token cookie),
// nên đổi IP cũng không lách được; request không có phiên thì đếm theo IP.
const PASSWORD_CHANGE_LIMIT = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
      keyGenerator: (request: FastifyRequest) => {
        const token = request.cookies?.[SESSION_COOKIE]
        return token ? `session:${hashToken(token)}` : `ip:${request.ip}`
      },
    },
  },
}

export function authRoutes(config: AppConfig) {
  return async function registerAuthRoutes(app: FastifyInstance) {
    /** Cấp phiên mới cho tài khoản và trả về thông tin như /auth/me. */
    async function startSession(userId: string, request: FastifyRequest, reply: FastifyReply) {
      const session = await createSession(userId, { ipAddress: request.ip, userAgent: request.headers['user-agent'] })
      // Vai trò tính theo trạng thái 2 lớp của chính phiên vừa tạo (NEW_SESSION_TWO_FACTOR_VERIFIED, không ghi cứng ở đây).
      const user = await loadAuthUser(userId, { twoFactorVerified: session.twoFactorVerified })
      if (!user) throw unauthenticated()
      reply.setCookie(SESSION_COOKIE, session.token, sessionCookieOptions(config))
      return getMe(user, { twoFactorVerified: session.twoFactorVerified })
    }

    // Giới hạn thô theo IP (SEC-05); khóa 15 phút sau 5 lần sai theo tài khoản nằm trong verifyLogin.
    app.post(
      '/auth/login',
      { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
      async (request, reply) => {
        const input = loginSchema.parse(request.body)
        const userId = await verifyLogin(input)
        // Đăng nhập lại trên cùng trình duyệt: bỏ phiên cũ trước khi cấp phiên mới.
        if (request.sessionId) await revokeSession(request.sessionId)
        return startSession(userId, request, reply)
      },
    )

    app.post('/auth/logout', { preHandler: requireSession }, async (request, reply) => {
      if (request.sessionId) await revokeSession(request.sessionId)
      clearSessionCookie(reply, config)
      return reply.code(204).send()
    })

    app.get('/auth/me', { preHandler: requireSession }, async (request) =>
      getMe(currentUser(request), { twoFactorVerified: request.twoFactorVerified }),
    )

    // A4 — FLOW-09: đổi mật khẩu tạm, thu hồi phiên cũ (kể cả phiên đang dùng) và cấp phiên mới.
    app.post('/auth/activate', { preHandler: requireSession, ...PASSWORD_CHANGE_LIMIT }, async (request, reply) => {
      const userId = currentUser(request).id
      await activateAccount(request, userId, request.body)
      return startSession(userId, request, reply)
    })

    // A4 — FLOW-10: đổi mật khẩu khi đang đăng nhập; các phiên khác bị đăng xuất, phiên này giữ nguyên.
    app.post('/auth/change-password', { preHandler: requireAuth, ...PASSWORD_CHANGE_LIMIT }, async (request, reply) => {
      await changePassword(request, currentUser(request).id, request.sessionId ?? '', request.body)
      return reply.code(204).send()
    })
  }
}

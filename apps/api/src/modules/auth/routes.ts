import type { FastifyInstance } from 'fastify'

import type { AppConfig } from '../../config.js'
import { unauthenticated } from '../../lib/errors.js'
import { currentUser, requireAuth } from './rbac.js'
import { getMe, loadAuthUser, loginSchema, verifyLogin } from './service.js'
import { clearSessionCookie, createSession, revokeSession, SESSION_COOKIE, sessionCookieOptions } from './session.js'

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
        const session = await createSession(userId, { ipAddress: request.ip, userAgent: request.headers['user-agent'] })
        // Vai trò tính theo trạng thái 2 lớp của chính phiên vừa tạo (không ghi cứng ở đây).
        const user = await loadAuthUser(userId, { twoFactorVerified: session.twoFactorVerified })
        if (!user) throw unauthenticated()
        reply.setCookie(SESSION_COOKIE, session.token, sessionCookieOptions(config))
        return getMe(user, { twoFactorVerified: session.twoFactorVerified })
      },
    )

    app.post('/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
      if (request.sessionId) await revokeSession(request.sessionId)
      clearSessionCookie(reply, config)
      return reply.code(204).send()
    })

    app.get('/auth/me', { preHandler: requireAuth }, async (request) =>
      getMe(currentUser(request), { twoFactorVerified: request.twoFactorVerified }),
    )
  }
}

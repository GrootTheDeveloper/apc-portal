import { createHash, randomBytes } from 'node:crypto'

import type { CookieSerializeOptions } from '@fastify/cookie'
import type { FastifyInstance, FastifyReply } from 'fastify'

import type { AppConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { forbidden } from '../../lib/errors.js'
import { loadAuthUser } from './service.js'

// Phiên lưu ở server (docs/06 mục 5, quyết định 1): cookie chỉ chứa token ngẫu nhiên 32 byte,
// database chỉ lưu SHA-256 của token. Hết hạn sau 8 giờ không hoạt động; thu hồi bằng revokedAt.

export const SESSION_COOKIE = 'apc_session'
export const SESSION_IDLE_MS = 8 * 60 * 60 * 1000
// Chỉ ghi lại lastActiveAt khi đã cũ hơn 1 phút, để mỗi request không phải ghi database.
const TOUCH_AFTER_MS = 60 * 1000

declare module 'fastify' {
  interface FastifyRequest {
    /** id dòng sessions của request hiện tại; null khi chưa đăng nhập. */
    sessionId: string | null
  }
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function createSession(userId: string, meta: { ipAddress: string; userAgent: string | undefined }) {
  const token = randomBytes(32).toString('base64url')
  await db.session.create({
    data: { userId, tokenHash: hashToken(token), ipAddress: meta.ipAddress, userAgent: meta.userAgent ?? null },
  })
  return token
}

/** Phiên còn hiệu lực ứng với token trong cookie, hoặc null (không có, đã thu hồi, quá 8 giờ không hoạt động). */
export async function findActiveSession(token: string, now = new Date()) {
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, revokedAt: true, lastActiveAt: true },
  })
  if (!session || session.revokedAt) return null
  const idleMs = now.getTime() - session.lastActiveAt.getTime()
  if (idleMs > SESSION_IDLE_MS) return null
  if (idleMs > TOUCH_AFTER_MS) await db.session.update({ where: { id: session.id }, data: { lastActiveAt: now } })
  return { id: session.id, userId: session.userId }
}

export async function revokeSession(sessionId: string) {
  await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } })
}

export function sessionCookieOptions(config: AppConfig): CookieSerializeOptions {
  return { httpOnly: true, sameSite: 'lax', path: '/', secure: config.NODE_ENV === 'production' }
}

export function clearSessionCookie(reply: FastifyReply, config: AppConfig) {
  reply.clearCookie(SESSION_COOKIE, sessionCookieOptions(config))
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Gắn `request.user` từ cookie `apc_session` cho mọi request, và chặn CSRF (docs/06 mục 5, quyết định 2):
 * request thay đổi dữ liệu đi kèm phiên (hoặc gọi /auth/*) phải có header Origin trùng WEB_URL.
 */
export function registerSession(app: FastifyInstance, config: AppConfig) {
  app.decorateRequest('sessionId', null)

  app.addHook('onRequest', async (request) => {
    if (!UNSAFE_METHODS.has(request.method)) return
    const usesSession = request.url.startsWith('/auth/') || (request.headers.cookie ?? '').includes(`${SESSION_COOKIE}=`)
    if (usesSession && request.headers.origin !== config.WEB_URL) throw forbidden('Yêu cầu không hợp lệ.')
  })

  // preHandler chạy sau onRequest của @fastify/cookie nên request.cookies đã có sẵn.
  app.addHook('preHandler', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE]
    if (!token) return

    const session = await findActiveSession(token)
    const user = session ? await loadAuthUser(session.userId) : null
    if (!session || !user) {
      // Tài khoản bị khóa/ngừng hoạt động: thu hồi luôn phiên cũ (docs/02 mục 12.5).
      if (session) await revokeSession(session.id)
      clearSessionCookie(reply, config)
      return
    }
    request.user = user
    request.sessionId = session.id
  })
}

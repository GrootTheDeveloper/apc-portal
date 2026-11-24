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
    /** Phiên hiện tại đã nhập mã 2 lớp chưa (false khi chưa đăng nhập). */
    twoFactorVerified: boolean
  }
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function createSession(userId: string, meta: { ipAddress: string; userAgent: string | undefined }) {
  const token = randomBytes(32).toString('base64url')
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      totpEnabledAt: true,
      roles: {
        where: { role: { in: ['BOARD', 'TECH_ADMIN'] } },
        select: { status: true },
      },
    },
  })

  // B3: đã bật 2FA, hoặc có BOARD/TECH_ADMIN đang hiệu lực/chờ (kể cả ACTIVE mà chưa bật 2FA, vd sau khi B6 đặt lại)
  // thì phiên mới chưa qua 2 lớp; chỉ nhập đúng mã 6 số / mã khôi phục / xác nhận thiết lập mới bật lên.
  const hasPrivileged = user?.roles.some((r) => r.status === 'ACTIVE' || r.status === 'PENDING')
  const twoFactorVerified = !(user?.totpEnabledAt || hasPrivileged)

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent ?? null,
      twoFactorVerified,
    },
  })
  return { token, twoFactorVerified }
}

/** Đánh dấu phiên hiện tại đã qua bước xác thực 2 lớp (B3, FLOW-27). */
export async function markSessionTwoFactorVerified(sessionId: string, tx: Pick<typeof db, 'session'> = db) {
  await tx.session.update({
    where: { id: sessionId },
    data: { twoFactorVerified: true },
  })
}

/** Thu hồi toàn bộ phiên của một người dùng (B3 khi đổi 2FA, A5 khi khóa/đổi mật khẩu). */
export async function revokeAllUserSessions(userId: string) {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/** Phiên còn hiệu lực ứng với token trong cookie, hoặc null (không có, đã thu hồi, quá 8 giờ không hoạt động). */
export async function findActiveSession(token: string, now = new Date()) {
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, revokedAt: true, lastActiveAt: true, twoFactorVerified: true },
  })
  if (!session || session.revokedAt) return null
  const idleMs = now.getTime() - session.lastActiveAt.getTime()
  if (idleMs > SESSION_IDLE_MS) return null
  if (idleMs > TOUCH_AFTER_MS) await db.session.update({ where: { id: session.id }, data: { lastActiveAt: now } })
  return { id: session.id, userId: session.userId, twoFactorVerified: session.twoFactorVerified }
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
 * mọi request POST/PUT/PATCH/DELETE phải có header Origin trùng WEB_URL, nếu không trả 403.
 */
export function registerSession(app: FastifyInstance, config: AppConfig) {
  app.decorateRequest('sessionId', null)
  app.decorateRequest('twoFactorVerified', false)

  app.addHook('onRequest', async (request) => {
    if (UNSAFE_METHODS.has(request.method) && request.headers.origin !== config.WEB_URL) {
      throw forbidden('Yêu cầu không hợp lệ.')
    }
  })

  // preHandler chạy sau onRequest của @fastify/cookie nên request.cookies đã có sẵn.
  app.addHook('preHandler', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE]
    if (!token) return

    const session = await findActiveSession(token)
    const user = session ? await loadAuthUser(session.userId, session) : null
    if (!session || !user) {
      // Tài khoản bị khóa/ngừng hoạt động: thu hồi luôn phiên cũ (docs/02 mục 12.5).
      if (session) await revokeSession(session.id)
      clearSessionCookie(reply, config)
      return
    }
    request.user = user
    request.sessionId = session.id
    request.twoFactorVerified = session.twoFactorVerified
  })
}

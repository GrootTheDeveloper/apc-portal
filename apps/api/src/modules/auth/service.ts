import { z } from 'zod'

import { db } from '../../db/client.js'
import { conflict, forbidden, unauthenticated } from '../../lib/errors.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { AUDIT_ACTIONS, audit, AuditCategory, type AuditRequestLike, AuditResult } from '../audit/service.js'
import { fieldError, newPasswordSchema, normalizePassword } from './password-policy.js'
import type { AuthUser, RoleGrant } from './rbac.js'

/** Vai trò đặc quyền chỉ có hiệu lực khi phiên đã nhập mã 2 lớp (RP-13, BR-19). */
const PRIVILEGED_ROLES = new Set(['BOARD', 'TECH_ADMIN'])

/**
 * Dựng `request.user` từ database (docs/06 mục 5, quyết định 3). Hook đọc phiên (A2) gọi hàm này.
 * `roles` = `{ role: 'MEMBER', departmentId: <ban của người dùng> }` + các dòng user_roles có trạng thái ACTIVE,
 * đã tới `startsAt` và chưa qua `expiresAt` (dòng quá hạn không tính dù chưa chuyển EXPIRED).
 * Phiên chưa `twoFactorVerified` thì bỏ BOARD, TECH_ADMIN (Vai trò & quyền mục 12.1).
 * Tài khoản bị khóa hoặc ngừng hoạt động trả về null, kể cả khi phiên cũ chưa hết hạn (mục 12.5).
 */
export async function loadAuthUser(
  userId: string,
  session: { twoFactorVerified: boolean },
  now = new Date(),
): Promise<AuthUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      mustChangePassword: true,
      departmentId: true,
      roles: {
        where: {
          status: 'ACTIVE',
          startsAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { role: true, departmentId: true },
      },
    },
  })
  if (!user || user.status === 'LOCKED' || user.status === 'INACTIVE') return null

  const stored = user.roles.filter(
    (grant) => grant.role !== 'MEMBER' && (session.twoFactorVerified || !PRIVILEGED_ROLES.has(grant.role)),
  )
  const roles: RoleGrant[] = [
    { role: 'MEMBER', departmentId: user.departmentId },
    ...stored.map((grant) => ({ role: grant.role, departmentId: grant.departmentId })),
  ]
  // Chờ kích hoạt hoặc đang dùng mật khẩu tạm (kể cả tài khoản ACTIVE vừa được cấp lại mật khẩu tạm ở A5):
  // chỉ được gọi /auth/me, /auth/logout, /auth/activate (FLOW-09 bước 2).
  const pending = user.status === 'PENDING_ACTIVATION' || user.mustChangePassword
  return { id: user.id, departmentId: user.departmentId, roles, ...(pending ? { pendingActivation: true as const } : {}) }
}

// ĐĂNG NHẬP (A2) ─────────────────────────────────────────────────────────────

// Khi đăng nhập chỉ chặn độ dài tối đa (tránh băm chuỗi quá dài); mật khẩu ngắn vẫn đi đường "sai mật khẩu".
export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(128),
})

export const MAX_FAILED_LOGINS = 5
export const LOCKOUT_MS = 15 * 60 * 1000

// Sai tên đăng nhập, sai mật khẩu, tài khoản đang bị chặn tạm thời, bị khóa: cùng một phản hồi (SEC-08).
const invalidCredentials = () => unauthenticated('Sai tên đăng nhập hoặc mật khẩu.')

// Băm giả để thời gian trả lời khi sai tên đăng nhập giống khi sai mật khẩu.
let dummyHash: Promise<string> | undefined
const getDummyHash = () => (dummyHash ??= hashPassword('mat-khau-gia-de-can-bang-thoi-gian'))

/**
 * Kiểm tra mật khẩu và trả về id tài khoản (SEC-05, SEC-08). Sai 5 lần liên tiếp thì chặn 15 phút;
 * trong lúc bị chặn, đúng mật khẩu vẫn nhận cùng câu "Sai tên đăng nhập hoặc mật khẩu".
 */
export async function verifyLogin(input: z.infer<typeof loginSchema>, now = new Date()) {
  const user = await db.user.findUnique({
    where: { username: input.username },
    select: {
      id: true,
      passwordHash: true,
      status: true,
      lockoutUntil: true,
      isTemporaryPassword: true,
      temporaryPasswordExpiresAt: true,
    },
  })

  if (!user) {
    // Vẫn băm để thời gian phản hồi giống khi tài khoản tồn tại.
    await verifyPassword(await getDummyHash(), input.password)
    throw invalidCredentials()
  }

  if (user.lockoutUntil && user.lockoutUntil > now) {
    await verifyPassword(await getDummyHash(), input.password)
    throw invalidCredentials()
  }

  if (!(await verifyPassword(user.passwordHash, normalizePassword(input.password)))) {
    const { failedLoginAttempts } = await db.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    })
    if (failedLoginAttempts >= MAX_FAILED_LOGINS) {
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockoutUntil: new Date(now.getTime() + LOCKOUT_MS) },
      })
    }
    throw invalidCredentials()
  }

  // Tài khoản khóa/ngừng hoạt động: không tạo phiên, vẫn báo chung (FLOW-10).
  if (user.status === 'LOCKED' || user.status === 'INACTIVE') throw invalidCredentials()
  // Mật khẩu tạm quá 72 giờ (BR-04, FLOW-09).
  if (user.isTemporaryPassword && user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt <= now) {
    throw unauthenticated('Mật khẩu tạm thời đã hết hạn. Liên hệ Ban Chủ nhiệm để được cấp lại.')
  }

  await db.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockoutUntil: null } })
  return user.id
}

/**
 * Bước 2 lớp web cần đưa người dùng tới (Sitemap mục 6.2, 11.1):
 * - `setup`: có vai trò BOARD/TECH_ADMIN đang chờ (PENDING), tức chưa thiết lập 2 lớp → `/account/setup-two-factor`.
 * - `verify`: đã có vai trò đặc quyền ACTIVE nhưng phiên này chưa nhập mã → `/account/two-factor`.
 * - `null`: không cần.
 */
export type TwoFactorStep = 'setup' | 'verify' | null

async function twoFactorStep(userId: string, sessionVerified: boolean, now: Date): Promise<TwoFactorStep> {
  const privileged = await db.userRole.findMany({
    where: {
      userId,
      role: { in: ['BOARD', 'TECH_ADMIN'] },
      status: { in: ['ACTIVE', 'PENDING'] },
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { status: true },
  })
  if (privileged.some((grant) => grant.status === 'ACTIVE')) return sessionVerified ? null : 'verify'
  return privileged.length > 0 ? 'setup' : null
}

/** Thông tin trả về cho web ở /auth/login và /auth/me. Không bao giờ chứa passwordHash. */
export async function getMe(user: AuthUser, session: { twoFactorVerified: boolean }, now = new Date()) {
  const profile = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { username: true, fullName: true, status: true, mustChangePassword: true },
  })
  const twoFactor = await twoFactorStep(user.id, session.twoFactorVerified, now)
  return { id: user.id, departmentId: user.departmentId, roles: user.roles, ...profile, twoFactor }
}

// KÍCH HOẠT & ĐỔI MẬT KHẨU (A4) ──────────────────────────────────────────────

const currentPasswordSchema = z.object({ currentPassword: z.string().min(1).max(1024) })

const passwordAudit = (action: typeof AUDIT_ACTIONS.ACCOUNT_ACTIVATE | typeof AUDIT_ACTIONS.ACCOUNT_CHANGE_PASSWORD, userId: string, revokedSessions: number) => ({
  action,
  targetType: 'USER',
  targetId: userId,
  category: AuditCategory.SECURITY,
  result: AuditResult.SUCCESS,
  metadata: { revokedSessions },
})

/**
 * Đổi mật khẩu tạm thành mật khẩu riêng (FLOW-09). Kích hoạt xong: ACTIVE, bỏ cờ mật khẩu tạm, ghi
 * passwordChangedAt, thu hồi MỌI phiên (route cấp phiên mới ngay sau đó) và ghi audit. Lỗi thì không đổi gì.
 */
export async function activateAccount(actor: AuditRequestLike, userId: string, input: unknown, now = new Date()) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      username: true,
      passwordHash: true,
      status: true,
      mustChangePassword: true,
      isTemporaryPassword: true,
      temporaryPasswordExpiresAt: true,
    },
  })
  if (user.status !== 'PENDING_ACTIVATION' && !user.mustChangePassword) throw conflict('Tài khoản đã được kích hoạt.')
  if (user.isTemporaryPassword && user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt <= now) {
    throw forbidden('Mật khẩu tạm thời đã hết hạn. Liên hệ Ban Chủ nhiệm để được cấp lại.')
  }

  const newPassword = normalizePassword(newPasswordSchema(user.username).parse(input).newPassword)
  if (await verifyPassword(user.passwordHash, newPassword)) {
    throw fieldError('newPassword', 'Mật khẩu mới phải khác mật khẩu tạm thời.')
  }

  const passwordHash = await hashPassword(newPassword)
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        // Chuyển PENDING_ACTIVATION → ACTIVE; tài khoản ACTIVE bị buộc đổi mật khẩu thì giữ ACTIVE.
        status: 'ACTIVE',
        mustChangePassword: false,
        isTemporaryPassword: false,
        temporaryPasswordExpiresAt: null,
        passwordChangedAt: now,
      },
    })
    const { count } = await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } })
    await audit(actor, passwordAudit(AUDIT_ACTIONS.ACCOUNT_ACTIVATE, userId, count), tx)
  })
}

/**
 * Thành viên tự đổi mật khẩu (FLOW-10): phải đúng mật khẩu hiện tại; xong thì thu hồi mọi phiên KHÁC,
 * giữ phiên đang dùng, ghi audit. Sai mật khẩu hiện tại hoặc mật khẩu mới không đạt thì mật khẩu cũ vẫn dùng được.
 */
export async function changePassword(actor: AuditRequestLike, userId: string, currentSessionId: string, input: unknown, now = new Date()) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { username: true, passwordHash: true },
  })
  const currentPassword = normalizePassword(currentPasswordSchema.parse(input).currentPassword)
  const newPassword = normalizePassword(newPasswordSchema(user.username).parse(input).newPassword)
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw fieldError('currentPassword', 'Mật khẩu hiện tại không đúng.')
  }
  if (newPassword === currentPassword) throw fieldError('newPassword', 'Mật khẩu mới phải khác mật khẩu hiện tại.')

  const passwordHash = await hashPassword(newPassword)
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: now } })
    const { count } = await tx.session.updateMany({
      where: { userId, revokedAt: null, id: { not: currentSessionId } },
      data: { revokedAt: now },
    })
    await audit(actor, passwordAudit(AUDIT_ACTIONS.ACCOUNT_CHANGE_PASSWORD, userId, count), tx)
  })
}

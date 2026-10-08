import { z } from 'zod'

import { db } from '../../db/client.js'
import { unauthenticated } from '../../lib/errors.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
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
  return { id: user.id, departmentId: user.departmentId, roles }
}

// ĐĂNG NHẬP (A2) ─────────────────────────────────────────────────────────────

/** Chính sách mật khẩu khi đặt/đổi mật khẩu (SEC-02): 15–128 ký tự. Dùng lại ở A4, A5. */
export const passwordSchema = z
  .string()
  .min(15, 'Mật khẩu phải có ít nhất 15 ký tự.')
  .max(128, 'Mật khẩu tối đa 128 ký tự.')

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

  if (!(await verifyPassword(user.passwordHash, input.password))) {
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

/** Thông tin trả về cho web ở /auth/login và /auth/me. Không bao giờ chứa passwordHash. */
export async function getMe(user: AuthUser) {
  const profile = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { username: true, fullName: true, status: true, mustChangePassword: true },
  })
  return { id: user.id, departmentId: user.departmentId, roles: user.roles, ...profile }
}

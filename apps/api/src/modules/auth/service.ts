import { z } from 'zod'

import { db } from '../../db/client.js'
import { rateLimited, unauthenticated } from '../../lib/errors.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import type { AuthUser, RoleGrant } from './rbac.js'

/**
 * Dựng `request.user` từ database (docs/06 mục 5, quyết định 3). `roles` chỉ gồm các dòng user_roles đang hiệu lực:
 * trạng thái ACTIVE, đã tới ngày bắt đầu và chưa hết hạn. BOARD/TECH_ADMIN chưa cài 2 lớp vẫn ở PENDING (RP-13).
 * Tài khoản bị khóa hoặc ngừng hoạt động trả về null, kể cả khi phiên cũ chưa hết hạn (docs/02 mục 12.5).
 */
export async function loadAuthUser(userId: string, now = new Date()): Promise<AuthUser | null> {
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

  const roles = user.roles.flatMap((grant): RoleGrant[] =>
    grant.role === 'MEMBER' ? [] : [{ role: grant.role, departmentId: grant.departmentId }],
  )
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

const invalidCredentials = () => unauthenticated('Sai tên đăng nhập hoặc mật khẩu.')
const tooManyAttempts = () => rateLimited('Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.')

// Tên đăng nhập không tồn tại cũng bị chờ 15 phút như tài khoản thật, để không lộ tài khoản nào có thật (SEC-05).
// Lưu trong bộ nhớ vì API chạy 1 process (docs/06 mục 5, quyết định 6).
const unknownUserFailures = new Map<string, { count: number; lockoutUntil: number }>()

function recordUnknownFailure(username: string, now: number) {
  if (unknownUserFailures.size > 10_000) unknownUserFailures.clear()
  const entry = unknownUserFailures.get(username) ?? { count: 0, lockoutUntil: 0 }
  entry.count += 1
  if (entry.count >= MAX_FAILED_LOGINS) {
    entry.count = 0
    entry.lockoutUntil = now + LOCKOUT_MS
  }
  unknownUserFailures.set(username, entry)
}

// Băm giả để thời gian trả lời khi sai tên đăng nhập giống khi sai mật khẩu.
let dummyHash: Promise<string> | undefined
const getDummyHash = () => (dummyHash ??= hashPassword('mat-khau-gia-de-can-bang-thoi-gian'))

/** Kiểm tra mật khẩu và trả về id tài khoản. Mọi lỗi đăng nhập chỉ báo chung một thông báo. */
export async function verifyLogin(input: z.infer<typeof loginSchema>, now = new Date()) {
  const username = input.username
  const user = await db.user.findUnique({
    where: { username },
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
    const entry = unknownUserFailures.get(username)
    if (entry && entry.lockoutUntil > now.getTime()) throw tooManyAttempts()
    await verifyPassword(await getDummyHash(), input.password)
    recordUnknownFailure(username, now.getTime())
    throw invalidCredentials()
  }

  if (user.lockoutUntil && user.lockoutUntil > now) throw tooManyAttempts()

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
    select: { username: true, fullName: true, mustChangePassword: true },
  })
  return { id: user.id, departmentId: user.departmentId, roles: user.roles, ...profile }
}

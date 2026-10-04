import { db } from '../../db/client.js'
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

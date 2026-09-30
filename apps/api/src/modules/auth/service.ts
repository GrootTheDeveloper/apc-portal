import { db } from '../../db/client.js'
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

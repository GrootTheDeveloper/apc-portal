import type { Prisma, Role } from '../../db/generated/client.js'
import { conflict } from '../../lib/errors.js'

// Vai trò đặc quyền và ngưỡng tối thiểu (RP-06, RP-07, RP-18). Dùng chung cho A5 (khóa, ngừng hoạt động),
// A6 (thu hồi vai trò) và A7 (bootstrap). Tách file riêng để test route có thể thay `assertPrivilegedMinimum`.

type Tx = Prisma.TransactionClient

export const PRIVILEGED: readonly Role[] = ['BOARD', 'TECH_ADMIN']

/** Tên vai trò hiển thị trong thông báo lỗi và trên web. */
export const ROLE_LABEL: Record<Role, string> = {
  MEMBER: 'Thành viên',
  DEPARTMENT_MANAGER: 'Quản lý ban',
  BOARD: 'Ban Chủ nhiệm',
  TECH_ADMIN: 'Quản trị viên kỹ thuật',
}

/** Điều kiện "vai trò đang có hiệu lực": ACTIVE, đã tới startsAt, chưa qua expiresAt. */
export const activeRoleWhere = (now: Date) => ({
  status: 'ACTIVE' as const,
  startsAt: { lte: now },
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
})

/**
 * Khóa advisory dùng chung cho MỌI thao tác làm thay đổi số người giữ vai trò đặc quyền (khóa, ngừng hoạt động,
 * cấp, thu hồi, thực hiện quyết định, bootstrap). Giữ đến hết transaction, nên các thao tác xếp hàng: ba BOARD
 * khóa chéo nhau cùng lúc thì người sau đếm lại sau khi người trước đã commit.
 */
export async function lockPrivilegedRoles(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('privileged-roles'))`
}

/**
 * Sau thao tác phải còn ít nhất 2 người KHÁC (tài khoản ACTIVE) giữ mỗi vai trò đặc quyền mà tài khoản này
 * đang giữ. Truyền `roles` để chỉ xét vai trò sắp bị thu hồi (A6). Không đạt → 409.
 */
export async function assertPrivilegedMinimum(tx: Tx, userId: string, roles: readonly Role[] = PRIVILEGED, now = new Date()) {
  await lockPrivilegedRoles(tx)
  const held = await tx.userRole.findMany({
    where: { userId, role: { in: roles.filter((role) => PRIVILEGED.includes(role)) }, ...activeRoleWhere(now) },
    select: { role: true },
    distinct: ['role'],
  })
  for (const { role } of held) {
    const others = await tx.userRole.findMany({
      where: { role, userId: { not: userId }, user: { status: 'ACTIVE' }, ...activeRoleWhere(now) },
      select: { userId: true },
      distinct: ['userId'],
    })
    if (others.length < 2) {
      throw conflict(`Không thực hiện được: production phải còn ít nhất 2 ${ROLE_LABEL[role].toLowerCase()} đang hoạt động.`)
    }
  }
}

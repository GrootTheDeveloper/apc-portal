import { db } from '../../db/client.js'
import type { Role } from '../../db/generated/client.js'
import { AUDIT_ACTIONS, AuditCategory, AuditResult, audit } from '../audit/service.js'
import { enqueueEmail } from '../email/service.js'
import { PRIVILEGED, activeRoleWhere } from './privileged.js'

// O6 — tác vụ `role-expiry` (chạy mỗi giờ): chuyển vai trò quá hạn sang EXPIRED và cảnh báo vai trò đặc quyền
// sắp hết hạn trước 30 ngày và 7 ngày (RP-03, ADM-08, AC-RBAC-06).

const SERVICE = { service: 'role-expiry' }
const DAY = 24 * 3600 * 1000
const WARN_WINDOW_DAYS = 30

const expiringWhere = (now: Date) => ({
  status: 'ACTIVE' as const,
  role: { in: [...PRIVILEGED] },
  expiresAt: { gt: now, lte: new Date(now.getTime() + WARN_WINDOW_DAYS * DAY) },
})

/** ACTIVE quá hạn → EXPIRED. Cập nhật có điều kiện nên hai lượt chạy song song không audit trùng. */
async function expireOverdueRoles(now: Date, only?: string[]) {
  const overdue = await db.userRole.findMany({
    where: { status: 'ACTIVE', expiresAt: { lte: now }, ...(only ? { id: { in: only } } : {}) },
    select: { id: true, userId: true, role: true, expiresAt: true },
  })
  let expired = 0
  for (const row of overdue) {
    await db.$transaction(async (tx) => {
      const { count } = await tx.userRole.updateMany({
        where: { id: row.id, status: 'ACTIVE', expiresAt: { lte: now } },
        data: { status: 'EXPIRED' },
      })
      if (count === 0) return
      expired++
      await audit(
        SERVICE,
        {
          action: AUDIT_ACTIONS.ROLE_EXPIRE,
          targetType: 'USER_ROLE',
          targetId: row.id,
          category: AuditCategory.SECURITY,
          result: AuditResult.SUCCESS,
          metadata: { userId: row.userId, role: row.role, expiresAt: row.expiresAt },
        },
        tx,
      )
    })
  }
  return expired
}

/** Gửi cảnh báo mốc 30/7 ngày: mỗi mốc một lần cho mỗi dòng (theo warnedLevel + warnedForExpiresAt). */
async function warnExpiringRoles(now: Date, only?: string[]) {
  const rows = await db.userRole.findMany({
    where: { ...expiringWhere(now), ...(only ? { id: { in: only } } : {}) },
    select: { id: true, expiresAt: true, user: { select: { email: true } } },
  })
  let warned = 0
  for (const row of rows) {
    const expiresAt = row.expiresAt!
    const level = expiresAt.getTime() - now.getTime() <= 7 * DAY ? 7 : 30
    await db.$transaction(async (tx) => {
      // Chưa báo (hoặc đã gia hạn: expiresAt khác lúc báo) hoặc mới báo mốc lớn hơn → nhận mốc này, đúng một lượt thắng.
      const { count } = await tx.userRole.updateMany({
        where: {
          id: row.id,
          status: 'ACTIVE',
          expiresAt,
          OR: [{ warnedForExpiresAt: null }, { warnedForExpiresAt: { not: expiresAt } }, { warnedLevel: { gt: level } }],
        },
        data: { warnedLevel: level, warnedForExpiresAt: expiresAt },
      })
      if (count === 0) return
      const boards = await tx.user.findMany({
        where: { status: 'ACTIVE', roles: { some: { role: 'BOARD', ...activeRoleWhere(now) } } },
        select: { email: true },
      })
      const recipients = new Set([row.user.email, ...boards.map((board) => board.email)])
      for (const to of recipients) await enqueueEmail(tx, { type: 'ROLE_EXPIRING', to, refType: 'USER_ROLE', refId: row.id })
      warned++
    })
  }
  return warned
}

/**
 * Một lượt của `startJob('role-expiry', ...)`. Test truyền `now` và `only` (id các dòng test tạo) để không chạm
 * vào vai trò thật trong DB dùng chung khi giả lập thời điểm ở tương lai.
 */
export async function runRoleExpiry(now = new Date(), only?: string[]) {
  const expired = await expireOverdueRoles(now, only)
  const warned = await warnExpiringRoles(now, only)
  return { expired, warned }
}

/**
 * Ô cảnh báo trên /admin/accounts: vai trò đặc quyền ACTIVE hết hạn trong 30 ngày, chưa có người kế nhiệm.
 * "Người kế nhiệm" (AC-RBAC-06, đọc thận trọng): tài khoản KHÁC, ACTIVE, đang giữ cùng vai trò ở trạng thái ACTIVE
 * và còn hiệu lực, được cấp SAU dòng sắp hết hạn, và hết hạn muộn hơn (hoặc không hết hạn). Gia hạn (đổi expiresAt
 * quá 30 ngày) thì dòng tự rời danh sách.
 */
export async function listExpiringRoles(now = new Date()) {
  const rows = await db.userRole.findMany({
    where: expiringWhere(now),
    select: { id: true, role: true, expiresAt: true, createdAt: true, userId: true, user: { select: { username: true, fullName: true } } },
    orderBy: { expiresAt: 'asc' },
  })
  if (rows.length === 0) return []
  const candidates = await db.userRole.findMany({
    where: { role: { in: [...new Set(rows.map((row) => row.role))] as Role[] }, user: { status: 'ACTIVE' }, ...activeRoleWhere(now) },
    select: { userId: true, role: true, createdAt: true, expiresAt: true },
  })
  return rows
    .filter(
      (row) =>
        !candidates.some(
          (next) =>
            next.role === row.role &&
            next.userId !== row.userId &&
            next.createdAt > row.createdAt &&
            (next.expiresAt === null || next.expiresAt > row.expiresAt!),
        ),
    )
    .map((row) => ({
      id: row.id,
      userId: row.userId,
      username: row.user.username,
      fullName: row.user.fullName,
      role: row.role,
      expiresAt: row.expiresAt!.toISOString(),
    }))
}

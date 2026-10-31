import { z } from 'zod'

import { db } from '../../db/client.js'
import type { Prisma, Role } from '../../db/generated/client.js'
import { conflict, forbidden, notFound } from '../../lib/errors.js'
import { AUDIT_ACTIONS, audit, AuditCategory, type AuditRequestLike, AuditResult } from '../audit/service.js'
import { fieldError } from '../auth/password-policy.js'
import type { AuthUser } from '../auth/rbac.js'
import { assertPrivilegedMinimum, reasonSchema } from './service.js'

// Vai trò & phạm vi (A6, FLOW-20, Vai trò & quyền §8.6, §9):
//   DEPARTMENT_MANAGER, BOARD, đổi ban: BOARD làm trực tiếp.
//   TECH_ADMIN (DUAL): BOARD ghi quyết định (role_decisions) → một TECH_ADMIN khác đang hoạt động thực hiện.
// Mỗi thao tác có hàm `...InTx(tx, ...)` (test chạy trong transaction rồi rollback) và hàm bọc mở transaction.

type Tx = Prisma.TransactionClient
type Actor = AuditRequestLike & { user: AuthUser | null }
export type RoleOptions = { enforcePrivilegedMinimum: boolean; now?: Date }

const MANAGED_ROLES = ['DEPARTMENT_MANAGER', 'BOARD', 'TECH_ADMIN'] as const
const ROLE_LABEL: Record<string, string> = {
  DEPARTMENT_MANAGER: 'Quản lý ban',
  BOARD: 'Ban Chủ nhiệm',
  TECH_ADMIN: 'Quản trị viên kỹ thuật',
}

const effective = (now: Date) => ({ startsAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] })

export const grantSchema = z.object({
  role: z.enum(MANAGED_ROLES, { error: 'Chọn vai trò.' }),
  departmentId: z.string().trim().min(1).nullish(),
  expiresAt: z.iso.datetime({ error: 'Ngày hết hạn không hợp lệ.' }).nullish(),
  reason: reasonSchema,
})
const reasonOnly = z.object({ reason: reasonSchema })
const changeDepartmentSchema = z.object({ departmentId: z.string({ error: 'Chọn ban mới.' }).trim().min(1, 'Chọn ban mới.'), reason: reasonSchema })

// ─── KIỂM TRA DÙNG CHUNG ────────────────────────────────────────────────────

const actorId = (actor: Actor) => actor.user?.id ?? null

/** Tài khoản đích: tồn tại (404), không phải chính mình (RP-05 → 403); khi gán thì phải đang hoạt động (409). */
async function loadTarget(tx: Tx, actor: Actor, userId: string, { mustBeActive }: { mustBeActive: boolean }) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true } })
  if (!user) throw notFound()
  if (actorId(actor) === userId) throw forbidden('Không ai được tự thay đổi vai trò hoặc phạm vi của chính mình.')
  if (mustBeActive && user.status !== 'ACTIVE') throw conflict('Chỉ gán vai trò cho tài khoản đang hoạt động.')
  return user
}

async function assertActiveDepartment(tx: Tx, departmentId: string | null | undefined) {
  if (!departmentId) throw fieldError('departmentId', 'Quản lý ban phải gắn với một ban.')
  const department = await tx.department.findUnique({ where: { id: departmentId }, select: { status: true } })
  if (department?.status !== 'ACTIVE') throw fieldError('departmentId', 'Chọn một ban đang hoạt động.')
}

/**
 * Vai trò đặc quyền bắt buộc ngày hết hạn không muộn hơn ngày kết thúc nhiệm kỳ (RP-03, QĐ-6).
 * Chưa cấu hình `SiteSetting.termEndsAt` → 409.
 */
async function assertPrivilegedExpiry(tx: Tx, expiresAt: string | null | undefined, now: Date) {
  const setting = await tx.siteSetting.findFirst({ select: { termEndsAt: true } })
  if (!setting?.termEndsAt) throw conflict('Chưa cấu hình ngày kết thúc nhiệm kỳ (trang Thông tin APC).')
  if (!expiresAt) throw fieldError('expiresAt', 'Vai trò đặc quyền cần ngày hết hạn.')
  const expiry = new Date(expiresAt)
  if (expiry <= now) throw fieldError('expiresAt', 'Ngày hết hạn phải ở tương lai.')
  if (expiry > setting.termEndsAt) {
    throw fieldError('expiresAt', 'Ngày hết hạn không được muộn hơn ngày kết thúc nhiệm kỳ.')
  }
  return expiry
}

/**
 * BR-21, RP-19: không vừa BOARD vừa TECH_ADMIN (kể cả dòng PENDING hoặc quyết định đang chờ),
 * và không gán trùng một vai trò đặc quyền đang có.
 */
async function assertPrivilegedExclusive(tx: Tx, userId: string, role: 'BOARD' | 'TECH_ADMIN', now: Date) {
  const held = await tx.userRole.findMany({
    where: { userId, role: { in: ['BOARD', 'TECH_ADMIN'] }, status: { in: ['PENDING', 'ACTIVE'] }, ...effective(now) },
    select: { role: true },
  })
  const pendingGrant = await tx.roleDecision.findFirst({
    where: { userId, action: 'GRANT', status: 'PENDING' },
    select: { role: true },
  })
  const roles = new Set([...held.map((grant) => grant.role), ...(pendingGrant ? [pendingGrant.role] : [])])
  const other = role === 'BOARD' ? 'TECH_ADMIN' : 'BOARD'
  if (roles.has(other)) throw conflict('Một tài khoản không được giữ cùng lúc Ban Chủ nhiệm và Quản trị viên kỹ thuật.')
  if (roles.has(role)) throw conflict(`Tài khoản đã có hoặc đang chờ vai trò ${ROLE_LABEL[role]}.`)
}

// Cột `users.totpEnabledAt` do B3 thêm (PR #36). Trước khi B3 merge cột chưa có: coi như chưa ai bật 2 lớp.
// Kiểm tra bằng information_schema (không gây lỗi) vì một câu SQL lỗi sẽ hủy cả transaction đang chạy.

/**
 * Tài khoản đã thiết lập 2 lớp chưa (`totpEnabledAt` khác null) — quyết định vai trò đặc quyền ACTIVE ngay hay PENDING
 * (RP-13). Người chưa thiết lập thì B3 tự chuyển PENDING → ACTIVE khi họ thiết lập xong.
 * Khi B3 đã merge, có thể thay bằng `tx.user.findUnique({ select: { totpEnabledAt: true } })`.
 */
export async function hasTwoFactorEnrolled(tx: Tx, userId: string) {
  const [column] = await tx.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'totpEnabledAt'
    ) AS "exists"`
  if (!column?.exists) return false
  const [user] = await tx.$queryRaw<{ enabled: boolean }[]>`
    SELECT "totpEnabledAt" IS NOT NULL AS "enabled" FROM "users" WHERE "id" = ${userId}`
  return user?.enabled ?? false
}

async function revokeSessions(tx: Tx, userId: string, now: Date) {
  await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } })
}

const roleAudit = (
  action: typeof AUDIT_ACTIONS.ROLE_GRANT | typeof AUDIT_ACTIONS.ROLE_REVOKE | typeof AUDIT_ACTIONS.ROLE_UPDATE_SCOPE,
  userId: string,
  reason: string,
  metadata: Record<string, unknown>,
) => ({
  action,
  targetType: 'USER',
  targetId: userId,
  category: AuditCategory.SECURITY,
  result: AuditResult.SUCCESS,
  reason,
  metadata,
})

// ─── GÁN ────────────────────────────────────────────────────────────────────

/**
 * BOARD gán vai trò. DEPARTMENT_MANAGER: ACTIVE ngay. BOARD: ACTIVE ngay (thu hồi phiên cũ) nếu đã có 2 lớp,
 * không thì PENDING đến khi xong B3. TECH_ADMIN: chỉ ghi quyết định, chờ TECH_ADMIN khác thực hiện.
 */
export async function grantRoleInTx(tx: Tx, actor: Actor, userId: string, input: unknown, options: RoleOptions) {
  const body = grantSchema.parse(input ?? {})
  const now = options.now ?? new Date()
  await loadTarget(tx, actor, userId, { mustBeActive: true })

  if (body.role === 'DEPARTMENT_MANAGER') {
    await assertActiveDepartment(tx, body.departmentId)
    const duplicate = await tx.userRole.count({
      where: { userId, role: 'DEPARTMENT_MANAGER', departmentId: body.departmentId!, status: { in: ['PENDING', 'ACTIVE'] }, ...effective(now) },
    })
    if (duplicate > 0) throw conflict('Tài khoản đã quản lý ban này.')
    const row = await tx.userRole.create({
      data: { userId, role: 'DEPARTMENT_MANAGER', departmentId: body.departmentId!, status: 'ACTIVE', startsAt: now, reason: body.reason, grantedById: actorId(actor) },
    })
    await audit(actor, roleAudit(AUDIT_ACTIONS.ROLE_GRANT, userId, body.reason, { role: row.role, departmentId: row.departmentId, userRoleId: row.id }), tx)
    return { kind: 'role' as const, id: row.id, status: row.status }
  }

  const expiresAt = await assertPrivilegedExpiry(tx, body.expiresAt, now)
  await assertPrivilegedExclusive(tx, userId, body.role, now)

  if (body.role === 'TECH_ADMIN') {
    const decision = await tx.roleDecision.create({
      data: { action: 'GRANT', role: 'TECH_ADMIN', userId, expiresAt, reason: body.reason, decidedById: actorId(actor)! },
    })
    await audit(actor, roleAudit(AUDIT_ACTIONS.ROLE_GRANT, userId, body.reason, { role: 'TECH_ADMIN', stage: 'decided', decisionId: decision.id }), tx)
    return { kind: 'decision' as const, id: decision.id, status: decision.status }
  }

  const enrolled = await hasTwoFactorEnrolled(tx, userId)
  const row = await tx.userRole.create({
    data: { userId, role: 'BOARD', status: enrolled ? 'ACTIVE' : 'PENDING', startsAt: now, expiresAt, reason: body.reason, grantedById: actorId(actor) },
  })
  if (enrolled) await revokeSessions(tx, userId, now)
  await audit(actor, roleAudit(AUDIT_ACTIONS.ROLE_GRANT, userId, body.reason, { role: 'BOARD', status: row.status, userRoleId: row.id }), tx)
  return { kind: 'role' as const, id: row.id, status: row.status }
}

// ─── THU HỒI ────────────────────────────────────────────────────────────────

async function loadRoleRow(tx: Tx, userId: string, roleId: string) {
  const row = await tx.userRole.findUnique({ where: { id: roleId } })
  if (!row || row.userId !== userId) throw notFound()
  if (row.status !== 'PENDING' && row.status !== 'ACTIVE') throw conflict('Vai trò này đã hết hiệu lực hoặc đã bị thu hồi.')
  return row
}

async function revokeRow(tx: Tx, actor: Actor, row: { id: string; userId: string; role: Role }, reason: string, options: RoleOptions, extra: Record<string, unknown> = {}) {
  const now = options.now ?? new Date()
  if (options.enforcePrivilegedMinimum && (row.role === 'BOARD' || row.role === 'TECH_ADMIN')) {
    await assertPrivilegedMinimum(tx, row.userId, [row.role], now)
  }
  await tx.userRole.update({
    where: { id: row.id },
    data: { status: 'REVOKED', revokedAt: now, revokedById: actorId(actor), revokeReason: reason },
  })
  await revokeSessions(tx, row.userId, now)
  await audit(actor, roleAudit(AUDIT_ACTIONS.ROLE_REVOKE, row.userId, reason, { role: row.role, userRoleId: row.id, ...extra }), tx)
}

/** BOARD thu hồi vai trò. TECH_ADMIN: chỉ ghi quyết định thu hồi (DUAL). Ngưỡng tối thiểu áp cho BOARD/TECH_ADMIN. */
export async function revokeRoleInTx(tx: Tx, actor: Actor, userId: string, roleId: string, input: unknown, options: RoleOptions) {
  const { reason } = reasonOnly.parse(input ?? {})
  await loadTarget(tx, actor, userId, { mustBeActive: false })
  const row = await loadRoleRow(tx, userId, roleId)

  if (row.role === 'TECH_ADMIN') {
    const pending = await tx.roleDecision.count({ where: { userRoleId: row.id, action: 'REVOKE', status: 'PENDING' } })
    if (pending > 0) throw conflict('Đã có quyết định thu hồi vai trò này đang chờ thực hiện.')
    const decision = await tx.roleDecision.create({
      data: { action: 'REVOKE', role: 'TECH_ADMIN', userId, userRoleId: row.id, reason, decidedById: actorId(actor)! },
    })
    await audit(actor, roleAudit(AUDIT_ACTIONS.ROLE_REVOKE, userId, reason, { role: 'TECH_ADMIN', stage: 'decided', decisionId: decision.id }), tx)
    return { kind: 'decision' as const, id: decision.id, status: decision.status }
  }
  await revokeRow(tx, actor, row, reason, options)
  return { kind: 'role' as const, id: row.id, status: 'REVOKED' as const }
}

// ─── ĐỔI BAN ────────────────────────────────────────────────────────────────

/**
 * Đổi ban của DEPARTMENT_MANAGER (RP-08): thu hồi phạm vi cũ rồi cấp phạm vi mới trong CÙNG transaction,
 * nên không có lúc nào người đó có quyền ở cả hai ban.
 */
export async function changeDepartmentInTx(tx: Tx, actor: Actor, userId: string, roleId: string, input: unknown, options: RoleOptions) {
  const body = changeDepartmentSchema.parse(input ?? {})
  const now = options.now ?? new Date()
  await loadTarget(tx, actor, userId, { mustBeActive: true })
  const row = await loadRoleRow(tx, userId, roleId)
  if (row.role !== 'DEPARTMENT_MANAGER') throw conflict('Chỉ đổi ban được cho vai trò Quản lý ban.')
  if (row.departmentId === body.departmentId) throw fieldError('departmentId', 'Chọn một ban khác ban hiện tại.')
  await assertActiveDepartment(tx, body.departmentId)
  // Không chuyển sang ban người đó đang quản lý sẵn ở một dòng khác (sẽ thành hai dòng trùng ban).
  const alreadyManaged = await tx.userRole.count({
    where: { userId, role: 'DEPARTMENT_MANAGER', departmentId: body.departmentId, status: { in: ['PENDING', 'ACTIVE'] }, ...effective(now) },
  })
  if (alreadyManaged > 0) throw conflict('Tài khoản đã quản lý ban này.')

  await tx.userRole.update({
    where: { id: row.id },
    data: { status: 'REVOKED', revokedAt: now, revokedById: actorId(actor), revokeReason: body.reason },
  })
  const next = await tx.userRole.create({
    data: {
      userId,
      role: 'DEPARTMENT_MANAGER',
      departmentId: body.departmentId,
      status: 'ACTIVE',
      startsAt: now,
      expiresAt: row.expiresAt,
      reason: body.reason,
      grantedById: actorId(actor),
    },
  })
  await audit(
    actor,
    roleAudit(AUDIT_ACTIONS.ROLE_UPDATE_SCOPE, userId, body.reason, {
      fromDepartmentId: row.departmentId,
      toDepartmentId: next.departmentId,
      revokedUserRoleId: row.id,
      userRoleId: next.id,
    }),
    tx,
  )
  return { kind: 'role' as const, id: next.id, status: next.status }
}

// ─── QUYẾT ĐỊNH TECH_ADMIN (DUAL) ───────────────────────────────────────────

/** Một TECH_ADMIN đang hoạt động (không phải người được gán) thực hiện quyết định của BOARD. */
export async function executeDecisionInTx(tx: Tx, actor: Actor, decisionId: string, options: RoleOptions) {
  const now = options.now ?? new Date()
  const decision = await tx.roleDecision.findUnique({ where: { id: decisionId } })
  if (!decision) throw notFound()
  if (decision.status !== 'PENDING') throw conflict('Quyết định này đã được xử lý.')
  if (actorId(actor) === decision.userId) throw forbidden('Không ai được tự thực hiện quyết định về vai trò của chính mình.')
  const meta = { stage: 'executed', decisionId: decision.id, decidedById: decision.decidedById }

  if (decision.action === 'GRANT') {
    await loadTarget(tx, actor, decision.userId, { mustBeActive: true })
    await tx.roleDecision.update({ where: { id: decision.id }, data: { status: 'EXECUTED' } }) // bỏ khỏi kiểm tra trùng
    await assertPrivilegedExclusive(tx, decision.userId, 'TECH_ADMIN', now)
    if (decision.expiresAt && decision.expiresAt <= now) throw conflict('Quyết định đã quá ngày hết hạn của vai trò.')
    const enrolled = await hasTwoFactorEnrolled(tx, decision.userId)
    const row = await tx.userRole.create({
      data: {
        userId: decision.userId,
        role: 'TECH_ADMIN',
        status: enrolled ? 'ACTIVE' : 'PENDING',
        startsAt: now,
        expiresAt: decision.expiresAt,
        reason: decision.reason,
        grantedById: decision.decidedById,
      },
    })
    if (enrolled) await revokeSessions(tx, decision.userId, now)
    await tx.roleDecision.update({
      where: { id: decision.id },
      data: { userRoleId: row.id, executedById: actorId(actor), executedAt: now },
    })
    await audit(actor, roleAudit(AUDIT_ACTIONS.ROLE_GRANT, decision.userId, decision.reason, { role: 'TECH_ADMIN', status: row.status, userRoleId: row.id, ...meta }), tx)
    return { status: 'EXECUTED' as const, userRoleId: row.id }
  }

  const row = await loadRoleRow(tx, decision.userId, decision.userRoleId ?? '')
  await revokeRow(tx, actor, row, decision.reason, options, meta)
  await tx.roleDecision.update({
    where: { id: decision.id },
    data: { status: 'EXECUTED', executedById: actorId(actor), executedAt: now },
  })
  return { status: 'EXECUTED' as const, userRoleId: row.id }
}

/** BOARD hủy quyết định chưa thực hiện. */
export async function cancelDecisionInTx(tx: Tx, actor: Actor, decisionId: string, input: unknown, options: RoleOptions) {
  const { reason } = reasonOnly.parse(input ?? {})
  const decision = await tx.roleDecision.findUnique({ where: { id: decisionId } })
  if (!decision) throw notFound()
  if (decision.status !== 'PENDING') throw conflict('Quyết định này đã được xử lý.')
  await tx.roleDecision.update({ where: { id: decisionId }, data: { status: 'CANCELLED', cancelledAt: options.now ?? new Date() } })
  const action = decision.action === 'GRANT' ? AUDIT_ACTIONS.ROLE_GRANT : AUDIT_ACTIONS.ROLE_REVOKE
  await audit(actor, roleAudit(action, decision.userId, reason, { role: decision.role, stage: 'cancelled', decisionId }), tx)
}

// Bọc transaction cho route.
export const grantRole = (actor: Actor, userId: string, input: unknown, options: RoleOptions) =>
  db.$transaction((tx) => grantRoleInTx(tx, actor, userId, input, options))
export const revokeRole = (actor: Actor, userId: string, roleId: string, input: unknown, options: RoleOptions) =>
  db.$transaction((tx) => revokeRoleInTx(tx, actor, userId, roleId, input, options))
export const changeDepartment = (actor: Actor, userId: string, roleId: string, input: unknown, options: RoleOptions) =>
  db.$transaction((tx) => changeDepartmentInTx(tx, actor, userId, roleId, input, options))
export const executeDecision = (actor: Actor, decisionId: string, options: RoleOptions) =>
  db.$transaction((tx) => executeDecisionInTx(tx, actor, decisionId, options))
export const cancelDecision = (actor: Actor, decisionId: string, input: unknown, options: RoleOptions) =>
  db.$transaction((tx) => cancelDecisionInTx(tx, actor, decisionId, input, options))

// ─── ĐỌC ────────────────────────────────────────────────────────────────────

const person = { select: { id: true, username: true, fullName: true } } as const

/** PAGE-MGT-MEM-06: vai trò, phạm vi, ngày hiệu lực/hết hạn, lý do và lịch sử; kèm quyết định DUAL của tài khoản. */
export async function getAccountRoles(viewer: AuthUser, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, username: true, fullName: true, status: true } })
  if (!user) throw notFound()
  const [roles, decisions, setting, departments] = await db.$transaction([
    db.userRole.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        role: true,
        status: true,
        startsAt: true,
        expiresAt: true,
        reason: true,
        revokedAt: true,
        revokeReason: true,
        createdAt: true,
        department: { select: { id: true, name: true } },
        grantedBy: person,
        revokedBy: person,
      },
    }),
    db.roleDecision.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { decidedBy: person, executedBy: person } }),
    db.siteSetting.findFirst({ select: { termEndsAt: true } }),
    db.department.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
  ])
  return { user, roles, decisions, termEndsAt: setting?.termEndsAt ?? null, departments, viewerId: viewer.id }
}

/** PAGE-MGT-MEM-07: hàng đợi quyết định TECH_ADMIN đang chờ, và các quyết định đã xử lý gần đây. */
export async function listDecisions() {
  const include = { user: person, decidedBy: person, executedBy: person } as const
  const [pending, recent] = await db.$transaction([
    db.roleDecision.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, include }),
    db.roleDecision.findMany({ where: { status: { not: 'PENDING' } }, orderBy: { updatedAt: 'desc' }, take: 20, include }),
  ])
  return { pending, recent }
}

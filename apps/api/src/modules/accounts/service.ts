import { randomBytes } from 'node:crypto'

import { z } from 'zod'

import { db } from '../../db/client.js'
import type { AccountStatus, Prisma, Role } from '../../db/generated/client.js'
import { conflict, forbidden, notFound } from '../../lib/errors.js'
import { pageArgs, pageQuery, toPage } from '../../lib/pagination.js'
import { hashPassword } from '../../lib/password.js'
import { AUDIT_ACTIONS, audit, AuditCategory, type AuditRequestLike, AuditResult } from '../audit/service.js'
import { fieldError } from '../auth/password-policy.js'
import { type AuthUser, hasRole } from '../auth/rbac.js'

// Quản lý tài khoản (A5, FLOW-11, Vai trò & quyền §8.2). Hàm dùng chung cho mảng khác:
//   createAccount(tx, actor, {...})          — R6 (chuyển ứng viên thành thành viên), A7 (bootstrap)
//   deactivateAccount(tx, actor, userId, {}) — T5 (thành viên Ngừng tham gia, QĐ-3)
//   assertPrivilegedMinimum(tx, userId, ...) — A6 (thu hồi vai trò đặc quyền)
// Mật khẩu tạm chỉ trả về MỘT lần trong phản hồi API tạo / cấp lại (STATE-03); không ghi log, audit hay email.

type Tx = Prisma.TransactionClient
const TEMP_PASSWORD_HOURS = 72 // BR-04
const PRIVILEGED: readonly Role[] = ['BOARD', 'TECH_ADMIN']
const ROLE_LABEL: Record<string, string> = { BOARD: 'Ban Chủ nhiệm', TECH_ADMIN: 'quản trị viên kỹ thuật' }

// ─── DỮ LIỆU ĐẦU VÀO ────────────────────────────────────────────────────────

export const reasonSchema = z.string({ error: 'Nhập lý do.' }).trim().min(3, 'Nhập lý do (ít nhất 3 ký tự).').max(500, 'Lý do tối đa 500 ký tự.')
// Sổ sự cố nằm ngoài hệ thống (O5) nên chỉ kiểm dạng mã (README kế hoạch §7.2).
export const incidentIdSchema = z.string({ error: 'Nhập mã sự cố dạng INC-YYYYMMDD-NN.' }).trim().regex(/^INC-\d{8}-\d{2}$/, 'Mã sự cố có dạng INC-YYYYMMDD-NN.')

/** `updatedAt` đã đọc: khác bản trên server thì 409, không ghi đè (STATE-09). */
const actionBase = z.object({ reason: reasonSchema, updatedAt: z.iso.datetime().optional() })

export const createAccountSchema = z.object({
  username: z
    .string({ error: 'Nhập tên đăng nhập.' })
    .trim()
    .toLowerCase()
    .min(3, 'Tên đăng nhập ít nhất 3 ký tự.')
    .max(50, 'Tên đăng nhập tối đa 50 ký tự.')
    .regex(/^[a-z0-9._-]+$/, 'Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, gạch ngang.'),
  email: z.email({ error: 'Email không hợp lệ.' }).trim().toLowerCase().max(200),
  fullName: z.string({ error: 'Nhập họ tên.' }).trim().min(2, 'Nhập họ tên.').max(120),
  departmentId: z.string().trim().min(1).nullish(),
})
export type CreateAccountInput = z.infer<typeof createAccountSchema>

export const listQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['PENDING_ACTIVATION', 'ACTIVE', 'LOCKED', 'INACTIVE']).optional(),
})

// ─── HÀM DÙNG CHUNG ─────────────────────────────────────────────────────────

/** Mật khẩu tạm ngẫu nhiên 20 ký tự, bỏ ký tự dễ nhầm (0/O, 1/l/I), chia nhóm cho dễ đọc. */
export function generateTemporaryPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(20)
  const chars = [...bytes].map((byte) => alphabet[byte % alphabet.length])
  return [0, 5, 10, 15].map((start) => chars.slice(start, start + 5).join('')).join('-')
}

const temporaryPasswordFields = async (password: string, now: Date) => ({
  passwordHash: await hashPassword(password),
  isTemporaryPassword: true,
  mustChangePassword: true,
  temporaryPasswordExpiresAt: new Date(now.getTime() + TEMP_PASSWORD_HOURS * 3600 * 1000),
  failedLoginAttempts: 0,
  lockoutUntil: null,
})

/**
 * Chuyển trạng thái tài khoản CÓ ĐIỀU KIỆN: chỉ ghi khi trạng thái hiện tại còn nằm trong `from` (BR-16).
 * Hai thao tác bấm cùng lúc (vd khóa và ngừng hoạt động) không ghi đè nhau: thao tác đến sau thấy 0 dòng → 409.
 */
async function transitionAccount(
  tx: Tx,
  userId: string,
  from: readonly AccountStatus[],
  data: Prisma.UserUpdateManyMutationInput,
  message: string,
) {
  const { count } = await tx.user.updateMany({ where: { id: userId, status: { in: [...from] } }, data })
  if (count === 0) throw conflict(message)
}

async function revokeAllSessions(tx: Tx, userId: string, now: Date) {
  const { count } = await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } })
  return count
}

/**
 * Tạo tài khoản ở PENDING_ACTIVATION, chỉ có vai trò nền MEMBER (RP-01), mật khẩu tạm 72 giờ.
 * Trả mật khẩu tạm để hiện MỘT lần cho người tạo. Ban phải đang ACTIVE (ORG-06). Trùng tên/email → 409.
 */
export async function createAccount(tx: Tx, actor: AuditRequestLike, input: CreateAccountInput, now = new Date()) {
  const data = createAccountSchema.parse(input)
  if (data.departmentId) {
    const department = await tx.department.findUnique({ where: { id: data.departmentId }, select: { status: true } })
    if (department?.status !== 'ACTIVE') throw fieldError('departmentId', 'Chọn một ban đang hoạt động.')
  }
  const temporaryPassword = generateTemporaryPassword()
  const user = await tx.user.create({
    data: {
      username: data.username,
      email: data.email,
      fullName: data.fullName,
      departmentId: data.departmentId ?? null,
      status: 'PENDING_ACTIVATION',
      ...(await temporaryPasswordFields(temporaryPassword, now)),
    },
    select: { id: true, username: true },
  })
  await audit(
    actor,
    {
      action: AUDIT_ACTIONS.ACCOUNT_CREATE,
      targetType: 'USER',
      targetId: user.id,
      category: AuditCategory.SECURITY,
      result: AuditResult.SUCCESS,
      metadata: { username: user.username },
    },
    tx,
  )
  return { user, temporaryPassword }
}

/**
 * Ngừng hoạt động (QĐ-3, RP-09): INACTIVE + deactivatedAt, thu hồi mọi phiên, mọi vai trò quản lý/đặc quyền
 * đang PENDING/ACTIVE chuyển REVOKED, ghi audit. Gọi trong transaction của nghiệp vụ.
 */
export async function deactivateAccount(
  tx: Tx,
  actor: AuditRequestLike,
  userId: string,
  { reason, enforcePrivilegedMinimum = false }: { reason: string; enforcePrivilegedMinimum?: boolean },
  now = new Date(),
) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } })
  if (!user) throw notFound()
  if (enforcePrivilegedMinimum) await assertPrivilegedMinimum(tx, userId)
  await transitionAccount(tx, userId, ['PENDING_ACTIVATION', 'ACTIVE', 'LOCKED'], { status: 'INACTIVE', deactivatedAt: now }, 'Tài khoản đã ngừng hoạt động.')
  const sessions = await revokeAllSessions(tx, userId, now)
  const actorId = 'service' in actor ? null : (actor.user?.id ?? null)
  const roles = await tx.userRole.updateMany({
    where: { userId, status: { in: ['PENDING', 'ACTIVE'] } },
    data: { status: 'REVOKED', revokedAt: now, revokedById: actorId },
  })
  await audit(
    actor,
    {
      action: AUDIT_ACTIONS.ACCOUNT_DEACTIVATE,
      targetType: 'USER',
      targetId: userId,
      category: AuditCategory.SECURITY,
      result: AuditResult.SUCCESS,
      reason,
      metadata: { revokedSessions: sessions, revokedRoles: roles.count },
    },
    tx,
  )
}

/**
 * Ngưỡng tối thiểu (RP-06, RP-07, RP-18): sau thao tác phải còn ít nhất 2 người KHÁC giữ mỗi vai trò đặc quyền
 * mà tài khoản này đang giữ. Truyền `roles` để chỉ xét vai trò sắp bị thu hồi (A6). Không đạt → 409.
 */
// Khóa advisory dùng chung cho mọi lần kiểm ngưỡng tối thiểu (giữ đến hết transaction).
const PRIVILEGED_MINIMUM_LOCK = 7_103_001

export async function assertPrivilegedMinimum(tx: Tx, userId: string, roles: readonly Role[] = PRIVILEGED, now = new Date()) {
  // Các transaction khóa/ngừng hoạt động/thu hồi vai trò đặc quyền xếp hàng tại đây: ba BOARD khóa chéo nhau cùng lúc
  // thì người sau đếm lại sau khi người trước đã commit, không cùng thấy "còn đủ 2" rồi cùng khóa.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PRIVILEGED_MINIMUM_LOCK})`
  const active = { status: 'ACTIVE' as const, startsAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
  const held = await tx.userRole.findMany({
    where: { userId, role: { in: roles.filter((role) => PRIVILEGED.includes(role)) }, ...active },
    select: { role: true },
    distinct: ['role'],
  })
  for (const { role } of held) {
    const others = await tx.userRole.findMany({
      where: { role, userId: { not: userId }, user: { status: 'ACTIVE' }, ...active },
      select: { userId: true },
      distinct: ['userId'],
    })
    if (others.length < 2) {
      throw conflict(`Không thực hiện được: production phải còn ít nhất 2 ${ROLE_LABEL[role] ?? role} đang hoạt động.`)
    }
  }
}

// ─── THAO TÁC CỦA TRANG /admin/accounts ─────────────────────────────────────

type Actor = AuditRequestLike & { user: AuthUser | null }
type Options = { enforcePrivilegedMinimum: boolean; now?: Date }

/** Đọc tài khoản đích, chặn tự thao tác trên chính mình (RP-05) và kiểm `updatedAt` đã đọc. */
async function loadTarget(tx: Tx, actor: Actor, userId: string, updatedAt?: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true, updatedAt: true } })
  if (!user) throw notFound()
  if (actor.user?.id === userId) throw forbidden('Không thể thực hiện thao tác này trên tài khoản của chính bạn.')
  if (updatedAt && new Date(updatedAt).getTime() !== user.updatedAt.getTime()) {
    throw conflict('Tài khoản vừa được người khác cập nhật. Vui lòng tải lại.')
  }
  return user
}

/** Bước chuyển sai sơ đồ trạng thái tài khoản (PRD §9.2) → 409 (BR-16). */
function assertFrom(status: AccountStatus, allowed: readonly AccountStatus[], message: string) {
  if (!allowed.includes(status)) throw conflict(message)
}

const accountAudit = (action: string, userId: string, extra: { reason?: string; incidentId?: string | null; metadata?: object } = {}) => ({
  action: action as (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
  targetType: 'USER',
  targetId: userId,
  category: AuditCategory.SECURITY,
  result: AuditResult.SUCCESS,
  reason: extra.reason ?? null,
  incidentId: extra.incidentId ?? null,
  metadata: (extra.metadata ?? null) as Record<string, unknown> | null,
})

/**
 * Khóa (FLOW-11): chặn đăng nhập, thu hồi mọi phiên ngay. BOARD khóa được; TECH_ADMIN chỉ theo quyền INCIDENT:
 * bắt buộc mã sự cố + lý do, nhật ký ghi incidentId.
 */
export async function lockAccount(actor: Actor, userId: string, input: unknown, options: Options) {
  const isBoard = !!actor.user && hasRole(actor.user, 'BOARD')
  const body = actionBase
    .extend({ incidentId: isBoard ? incidentIdSchema.optional() : incidentIdSchema })
    .parse(input ?? {})
  const now = options.now ?? new Date()
  return db.$transaction(async (tx) => {
    const user = await loadTarget(tx, actor, userId, body.updatedAt)
    const lockable = ['PENDING_ACTIVATION', 'ACTIVE'] as const
    const message = 'Chỉ khóa được tài khoản đang chờ kích hoạt hoặc đang hoạt động.'
    assertFrom(user.status, lockable, message)
    if (options.enforcePrivilegedMinimum) await assertPrivilegedMinimum(tx, userId)
    await transitionAccount(tx, userId, lockable, { status: 'LOCKED' }, message)
    const revokedSessions = await revokeAllSessions(tx, userId, now)
    await audit(
      actor,
      accountAudit(AUDIT_ACTIONS.ACCOUNT_LOCK, userId, {
        reason: body.reason,
        incidentId: body.incidentId ?? null,
        metadata: { revokedSessions },
      }),
      tx,
    )
  })
}

/** Mở khóa: LOCKED → ACTIVE; không khôi phục phiên cũ, người dùng phải đăng nhập lại. Chỉ BOARD. */
export async function unlockAccount(actor: Actor, userId: string, input: unknown) {
  const body = actionBase.parse(input ?? {})
  return db.$transaction(async (tx) => {
    const user = await loadTarget(tx, actor, userId, body.updatedAt)
    assertFrom(user.status, ['LOCKED'], 'Chỉ mở khóa được tài khoản đang bị khóa.')
    await transitionAccount(
      tx,
      userId,
      ['LOCKED'],
      { status: 'ACTIVE', failedLoginAttempts: 0, lockoutUntil: null },
      'Chỉ mở khóa được tài khoản đang bị khóa.',
    )
    await audit(actor, accountAudit(AUDIT_ACTIONS.ACCOUNT_UNLOCK, userId, { reason: body.reason }), tx)
  })
}

/**
 * Cấp lại mật khẩu tạm 72 giờ (FLOW-11 bước 6): thu hồi mọi phiên; lần đăng nhập sau phải đổi mật khẩu (A4).
 * Trả mật khẩu tạm để hiện MỘT lần cho BOARD; không gửi email. Chỉ BOARD.
 */
export async function resetTemporaryPassword(actor: Actor, userId: string, input: unknown, options: Options) {
  const body = actionBase.parse(input ?? {})
  return db.$transaction(async (tx) => {
    const user = await loadTarget(tx, actor, userId, body.updatedAt)
    assertFrom(user.status, ['PENDING_ACTIVATION', 'ACTIVE', 'LOCKED'], 'Tài khoản đã ngừng hoạt động.')
    return reissueTemporaryPassword(tx, actor, userId, body.reason, options.now)
  })
}

/**
 * Đặt mật khẩu tạm mới 72 giờ, thu hồi mọi phiên, ghi audit (không ghi mật khẩu). Trả mật khẩu tạm để hiện một lần.
 * Dùng trong transaction của nghiệp vụ: trang quản trị (A5) và lệnh bootstrap (A7).
 */
export async function reissueTemporaryPassword(tx: Tx, actor: AuditRequestLike, userId: string, reason: string, now = new Date()) {
  const temporaryPassword = generateTemporaryPassword()
  const fields = await temporaryPasswordFields(temporaryPassword, now)
  // Có điều kiện trạng thái: tài khoản vừa bị ngừng hoạt động bởi thao tác khác thì 409, không ghi đè.
  await transitionAccount(tx, userId, ['PENDING_ACTIVATION', 'ACTIVE', 'LOCKED'], fields, 'Tài khoản đã ngừng hoạt động.')
  const revokedSessions = await revokeAllSessions(tx, userId, now)
  await audit(actor, accountAudit(AUDIT_ACTIONS.ACCOUNT_RESET_PASSWORD, userId, { reason, metadata: { revokedSessions } }), tx)
  return { temporaryPassword, expiresAt: fields.temporaryPasswordExpiresAt }
}

/** Ngừng hoạt động từ trang quản trị. Chỉ BOARD. */
export async function deactivateFromAdmin(actor: Actor, userId: string, input: unknown, options: Options) {
  const body = actionBase.parse(input ?? {})
  return db.$transaction(async (tx) => {
    await loadTarget(tx, actor, userId, body.updatedAt)
    await deactivateAccount(
      tx,
      actor,
      userId,
      { reason: body.reason, enforcePrivilegedMinimum: options.enforcePrivilegedMinimum },
      options.now,
    )
  })
}

/** Thu hồi toàn bộ phiên (BOARD, TECH_ADMIN). Lý do không bắt buộc. Thu hồi phiên của chính mình được phép. */
export async function revokeSessionsFromAdmin(actor: Actor, userId: string, input: unknown) {
  const body = z.object({ reason: reasonSchema.optional() }).parse(input ?? {})
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) throw notFound()
    const revokedSessions = await revokeAllSessions(tx, userId, new Date())
    await audit(
      actor,
      accountAudit(AUDIT_ACTIONS.ACCOUNT_REVOKE_SESSION, userId, {
        ...(body.reason ? { reason: body.reason } : {}),
        metadata: { revokedSessions },
      }),
      tx,
    )
    return { revokedSessions }
  })
}

// ─── ĐỌC DỮ LIỆU THEO VAI TRÒ ───────────────────────────────────────────────
// BOARD thấy thông tin nghiệp vụ, không thấy trạng thái kỹ thuật; TECH_ADMIN ngược lại (Vai trò & quyền §8.2).

const activeSessionWhere = (now: Date) => ({
  revokedAt: null,
  lastActiveAt: { gt: new Date(now.getTime() - 8 * 3600 * 1000) },
})

export async function listAccounts(viewer: AuthUser, query: unknown, now = new Date()) {
  const params = listQuery.parse(query)
  const board = hasRole(viewer, 'BOARD')
  const where: Prisma.UserWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.q
      ? {
          OR: [
            { username: { contains: params.q, mode: 'insensitive' } },
            { fullName: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
  const [rows, total] = await db.$transaction([
    db.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...pageArgs(params),
      select: {
        id: true,
        username: true,
        fullName: true,
        status: true,
        updatedAt: true,
        email: board,
        department: board ? { select: { id: true, name: true } } : false,
        failedLoginAttempts: !board,
        lockoutUntil: !board,
        _count: board ? false : { select: { sessions: { where: activeSessionWhere(now) } } },
      },
    }),
    db.user.count({ where }),
  ])
  const items = rows.map(({ _count, ...row }) => (_count ? { ...row, activeSessions: _count.sessions } : row))
  return toPage(items, total, params)
}

export async function getAccount(viewer: AuthUser, userId: string, now = new Date()) {
  const board = hasRole(viewer, 'BOARD')
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      fullName: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      ...(board
        ? {
            email: true,
            memberStatus: true,
            department: { select: { id: true, name: true } },
            mustChangePassword: true,
            isTemporaryPassword: true,
            temporaryPasswordExpiresAt: true,
            passwordChangedAt: true,
            deactivatedAt: true,
            roles: {
              where: { status: { in: ['PENDING', 'ACTIVE'] } },
              select: { role: true, status: true, department: { select: { name: true } }, expiresAt: true },
            },
          }
        : {
            failedLoginAttempts: true,
            lockoutUntil: true,
            passwordChangedAt: true,
            sessions: {
              where: activeSessionWhere(now),
              orderBy: { lastActiveAt: 'desc' },
              select: { id: true, createdAt: true, lastActiveAt: true, ipAddress: true, userAgent: true, twoFactorVerified: true },
            },
          }),
    },
  })
  if (!user) throw notFound()
  return user
}

export async function listActiveDepartments() {
  return db.department.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { id: true, name: true } })
}

import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { Prisma } from '../../db/generated/client.js'
import { hashPassword } from '../../lib/password.js'
import type { AuthUser } from '../auth/rbac.js'
import { SESSION_COOKIE } from '../auth/session.js'
import { lockPrivilegedRoles } from './privileged.js'
import { cancelDecisionInTx, changeDepartmentInTx, executeDecisionInTx, grantRoleInTx, hasTwoFactorEnrolled, revokeRoleInTx } from './roles.js'

// A6 — vai trò & phạm vi. Test API cho quyền và các thao tác không cần ngày nhiệm kỳ;
// test service trong transaction rồi rollback cho phần phụ thuộc SiteSetting và số BOARD toàn hệ thống.
const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const origin = { origin: config.WEB_URL }
const PASSWORD = 'mat-khau-test-vai-tro-a6'
const tag = randomUUID().slice(0, 8)
const DAY = 24 * 3600 * 1000
const userIds: string[] = []
const departmentIds: string[] = []
let passwordHash: string
let ip = 0
const tokens = { board: '', tech: '', manager: '', member: '' }
let deptA: { id: string }
let deptB: { id: string }
let archived: { id: string }
let boardUser: { id: string }

type Tx = Prisma.TransactionClient
const OPTIONS = { enforcePrivilegedMinimum: false }

async function createUser(name: string, role?: 'BOARD' | 'TECH_ADMIN' | 'DEPARTMENT_MANAGER', departmentId?: string) {
  const user = await db.user.create({
    data: { username: `${name}-${tag}`, email: `${name}-${tag}@test.local`, passwordHash, fullName: name, status: 'ACTIVE', mustChangePassword: false, departmentId: departmentId ?? null },
  })
  userIds.push(user.id)
  if (role) {
    await db.userRole.create({
      data: { userId: user.id, role, departmentId: role === 'DEPARTMENT_MANAGER' ? (departmentId ?? null) : null, status: 'ACTIVE', startsAt: new Date(Date.now() - 1000), reason: 'test' },
    })
  }
  return user
}

async function login(username: string) {
  const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { username, password: PASSWORD }, headers: origin, remoteAddress: `10.6.0.${++ip % 250}` })
  return response.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? ''
}

const call = (method: 'GET' | 'POST', url: string, token: string, payload?: object) =>
  app.inject({ method, url, cookies: token ? { [SESSION_COOKIE]: token } : {}, headers: origin, ...(payload ? { payload } : {}) })

/** Người thực hiện giả cho hàm service (giống request đã qua requireRole). */
const actor = (id: string, role: 'BOARD' | 'TECH_ADMIN') => ({
  user: { id, departmentId: null, roles: [{ role: 'MEMBER', departmentId: null }, { role, departmentId: null }] } as AuthUser,
  ip: '127.0.0.1',
  headers: {},
})

/** Chạy trong transaction rồi rollback; đặt sẵn ngày kết thúc nhiệm kỳ (hoặc bỏ trống). */
async function isolated(termEndsAt: Date | null, check: (tx: Tx) => Promise<void>) {
  const rollback = new Error('rollback')
  await db
    .$transaction(
      async (tx) => {
        // Chặn file test khác ghi user_roles đến khi rollback, để trạng thái "trống" không bị chen vào.
        // Khóa advisory trước, khóa bảng sau: cùng thứ tự với route, không deadlock với file test khác.
        await lockPrivilegedRoles(tx)
        await tx.$executeRaw`LOCK TABLE "user_roles" IN SHARE ROW EXCLUSIVE MODE`
        await tx.siteSetting.deleteMany({})
        if (termEndsAt) await tx.siteSetting.create({ data: { info: {}, termEndsAt } })
        await check(tx)
        throw rollback
      },
      { timeout: 20_000 },
    )
    .catch((error) => {
      if (error !== rollback) throw error
    })
}

async function userIn(tx: Tx, name: string, role?: 'BOARD' | 'TECH_ADMIN', status: 'ACTIVE' | 'PENDING' = 'ACTIVE') {
  const user = await tx.user.create({
    data: { username: `${name}-${tag}`, email: `${name}-${tag}@test.local`, passwordHash, fullName: name, status: 'ACTIVE', mustChangePassword: false },
  })
  if (role) await tx.userRole.create({ data: { userId: user.id, role, status, startsAt: new Date(Date.now() - 1000), reason: 'test' } })
  return user
}

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD)
  await app.ready()
  deptA = await db.department.create({ data: { name: 'Ban A6-A', code: `a6a-${tag}` } })
  deptB = await db.department.create({ data: { name: 'Ban A6-B', code: `a6b-${tag}` } })
  archived = await db.department.create({ data: { name: 'Ban A6 cũ', code: `a6x-${tag}`, status: 'ARCHIVED' } })
  departmentIds.push(deptA.id, deptB.id, archived.id)
  boardUser = await createUser('board', 'BOARD')
  const tech = await createUser('tech', 'TECH_ADMIN')
  const manager = await createUser('manager', 'DEPARTMENT_MANAGER', deptA.id)
  const member = await createUser('member', undefined, deptA.id)
  tokens.board = await login(`board-${tag}`)
  tokens.tech = await login(tech.username)
  tokens.manager = await login(manager.username)
  tokens.member = await login(member.username)
})

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { targetId: { in: userIds } }] } })
  await db.roleDecision.deleteMany({ where: { userId: { in: userIds } } })
  await db.session.deleteMany({ where: { userId: { in: userIds } } })
  await db.userRole.deleteMany({ where: { userId: { in: userIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await db.department.deleteMany({ where: { id: { in: departmentIds } } })
  await app.close()
  await db.$disconnect()
})

describe('who may change roles', () => {
  it('blocks managers and members (403), TECH_ADMIN granting BOARD (403), and anyone changing their own roles', async () => {
    const target = await createUser('perm-target')
    const body = { role: 'DEPARTMENT_MANAGER', departmentId: deptA.id, reason: 'Phụ trách ban' }
    expect((await call('POST', `/admin/accounts/${target.id}/roles`, tokens.manager, body)).statusCode).toBe(403)
    expect((await call('POST', `/admin/accounts/${target.id}/roles`, tokens.member, body)).statusCode).toBe(403)
    expect((await call('POST', `/admin/accounts/${target.id}/roles`, tokens.tech, { role: 'BOARD', expiresAt: new Date(Date.now() + DAY).toISOString(), reason: 'Thử' })).statusCode).toBe(403)
    expect((await call('GET', `/admin/accounts/${target.id}/roles`, tokens.member)).statusCode).toBe(403)
    // Tự gán cho chính mình.
    expect((await call('POST', `/admin/accounts/${boardUser.id}/roles`, tokens.board, body)).statusCode).toBe(403)
    // Thực hiện quyết định chỉ dành cho TECH_ADMIN.
    expect((await call('POST', '/admin/access-control/khong-co/execute', tokens.board)).statusCode).toBe(403)
  })
})

describe('department manager', () => {
  it('grants with a reason and an active department, then lists it with its history', async () => {
    const target = await createUser('dm-grant')
    const url = `/admin/accounts/${target.id}/roles`
    expect((await call('POST', url, tokens.board, { role: 'DEPARTMENT_MANAGER', departmentId: deptA.id })).statusCode).toBe(422)
    expect((await call('POST', url, tokens.board, { role: 'DEPARTMENT_MANAGER', reason: 'Không có ban' })).statusCode).toBe(422)
    expect((await call('POST', url, tokens.board, { role: 'DEPARTMENT_MANAGER', departmentId: archived.id, reason: 'Ban cũ' })).statusCode).toBe(422)

    const granted = await call('POST', url, tokens.board, { role: 'DEPARTMENT_MANAGER', departmentId: deptA.id, reason: 'Phụ trách ban A' })
    expect(granted.statusCode).toBe(201)
    expect(granted.json()).toMatchObject({ kind: 'role', status: 'ACTIVE' })
    expect((await call('POST', url, tokens.board, { role: 'DEPARTMENT_MANAGER', departmentId: deptA.id, reason: 'Lần hai' })).statusCode).toBe(409)

    const listed = await call('GET', url, tokens.board)
    expect(listed.json().roles[0]).toMatchObject({ role: 'DEPARTMENT_MANAGER', status: 'ACTIVE', reason: 'Phụ trách ban A', department: { name: 'Ban A6-A' } })
  })

  it('moves a manager to another department without ever holding both', async () => {
    const target = await createUser('dm-move', 'DEPARTMENT_MANAGER', deptA.id)
    const row = await db.userRole.findFirstOrThrow({ where: { userId: target.id } })
    const url = `/admin/accounts/${target.id}/roles/${row.id}/change-department`
    expect((await call('POST', url, tokens.board, { departmentId: deptA.id, reason: 'Cùng ban' })).statusCode).toBe(422)
    expect((await call('POST', url, tokens.board, { departmentId: deptB.id, reason: 'Chuyển sang ban B' })).statusCode).toBe(200)

    const rows = await db.userRole.findMany({ where: { userId: target.id }, orderBy: { createdAt: 'asc' } })
    expect(rows.map((r) => [r.departmentId, r.status])).toEqual([
      [deptA.id, 'REVOKED'],
      [deptB.id, 'ACTIVE'],
    ])
    const log = await db.auditLog.findFirstOrThrow({ where: { targetId: target.id, action: 'role.update_scope' } })
    expect(log.metadata).toMatchObject({ fromDepartmentId: deptA.id, toDepartmentId: deptB.id })
  })

  it('revokes with a reason and signs the person out', async () => {
    const target = await createUser('dm-revoke', 'DEPARTMENT_MANAGER', deptA.id)
    const token = await login(target.username)
    const row = await db.userRole.findFirstOrThrow({ where: { userId: target.id } })
    const url = `/admin/accounts/${target.id}/roles/${row.id}/revoke`
    expect((await call('POST', url, tokens.board, {})).statusCode).toBe(422)
    expect((await call('POST', url, tokens.board, { reason: 'Hết nhiệm kỳ ban' })).statusCode).toBe(200)
    expect((await db.userRole.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('REVOKED')
    expect((await call('GET', '/auth/me', token)).statusCode).toBe(401)
    expect((await call('POST', url, tokens.board, { reason: 'Lần hai' })).statusCode).toBe(409)
  })
})

describe('privileged roles and term end (RP-03, QĐ-6)', () => {
  it('needs termEndsAt (409) and an expiry not after it (422); BOARD without two-factor stays PENDING', async () => {
    const until = new Date(Date.now() + 90 * DAY)
    await isolated(null, async (tx) => {
      const board = await userIn(tx, 'term-board', 'BOARD')
      const target = await userIn(tx, 'term-none')
      await expect(
        grantRoleInTx(tx, actor(board.id, 'BOARD'), target.id, { role: 'BOARD', expiresAt: until.toISOString(), reason: 'Bầu bổ sung' }, OPTIONS),
      ).rejects.toMatchObject({ statusCode: 409 })
    })
    await isolated(until, async (tx) => {
      const board = await userIn(tx, 'term-board2', 'BOARD')
      const target = await userIn(tx, 'term-target')
      const tooLate = new Date(until.getTime() + DAY).toISOString()
      await expect(
        grantRoleInTx(tx, actor(board.id, 'BOARD'), target.id, { role: 'BOARD', expiresAt: tooLate, reason: 'Bầu bổ sung' }, OPTIONS),
      ).rejects.toMatchObject({ issues: [expect.objectContaining({ path: ['expiresAt'] })] })
      await expect(
        grantRoleInTx(tx, actor(board.id, 'BOARD'), target.id, { role: 'BOARD', reason: 'Thiếu ngày' }, OPTIONS),
      ).rejects.toMatchObject({ issues: [expect.objectContaining({ path: ['expiresAt'] })] })
      const result = await grantRoleInTx(tx, actor(board.id, 'BOARD'), target.id, { role: 'BOARD', expiresAt: until.toISOString(), reason: 'Bầu bổ sung' }, OPTIONS)
      expect(result).toMatchObject({ kind: 'role', status: 'PENDING' })
    })
  })

  it('never lets one account hold BOARD and TECH_ADMIN, even while one is pending (409)', async () => {
    const until = new Date(Date.now() + 90 * DAY)
    await isolated(until, async (tx) => {
      const board = await userIn(tx, 'ex-board', 'BOARD')
      const pendingBoard = await userIn(tx, 'ex-pb', 'BOARD', 'PENDING')
      const tech = await userIn(tx, 'ex-tech', 'TECH_ADMIN')
      const by = actor(board.id, 'BOARD')
      const body = (role: string) => ({ role, expiresAt: until.toISOString(), reason: 'Thử' })
      await expect(grantRoleInTx(tx, by, pendingBoard.id, body('TECH_ADMIN'), OPTIONS)).rejects.toMatchObject({ statusCode: 409 })
      await expect(grantRoleInTx(tx, by, tech.id, body('BOARD'), OPTIONS)).rejects.toMatchObject({ statusCode: 409 })
      // Quyết định TECH_ADMIN đang chờ cũng tính.
      const plain = await userIn(tx, 'ex-plain')
      await grantRoleInTx(tx, by, plain.id, body('TECH_ADMIN'), OPTIONS)
      await expect(grantRoleInTx(tx, by, plain.id, body('BOARD'), OPTIONS)).rejects.toMatchObject({ statusCode: 409 })
    })
  })

  it('TECH_ADMIN only takes effect after another active TECH_ADMIN executes the BOARD decision', async () => {
    const until = new Date(Date.now() + 90 * DAY)
    await isolated(until, async (tx) => {
      const board = await userIn(tx, 'dual-board', 'BOARD')
      const executor = await userIn(tx, 'dual-tech', 'TECH_ADMIN')
      const target = await userIn(tx, 'dual-target')
      const decided = await grantRoleInTx(tx, actor(board.id, 'BOARD'), target.id, { role: 'TECH_ADMIN', expiresAt: until.toISOString(), reason: 'Thêm người vận hành' }, OPTIONS)
      expect(decided.kind).toBe('decision')
      expect(await tx.userRole.count({ where: { userId: target.id } })).toBe(0)

      // Người được gán không tự thực hiện được.
      await expect(executeDecisionInTx(tx, actor(target.id, 'TECH_ADMIN'), decided.id, OPTIONS)).rejects.toMatchObject({ statusCode: 403 })
      const done = await executeDecisionInTx(tx, actor(executor.id, 'TECH_ADMIN'), decided.id, OPTIONS)
      const row = await tx.userRole.findUniqueOrThrow({ where: { id: done.userRoleId } })
      expect(row).toMatchObject({ role: 'TECH_ADMIN', status: 'PENDING', grantedById: board.id })
      const log = await tx.auditLog.findFirstOrThrow({ where: { targetId: target.id, actorId: executor.id, action: 'role.grant' } })
      expect(log.metadata).toMatchObject({ stage: 'executed', decidedById: board.id })
      await expect(executeDecisionInTx(tx, actor(executor.id, 'TECH_ADMIN'), decided.id, OPTIONS)).rejects.toMatchObject({ statusCode: 409 })
    })
  })

  it('revoking TECH_ADMIN is a decision too; BOARD can cancel a pending decision', async () => {
    const until = new Date(Date.now() + 90 * DAY)
    await isolated(until, async (tx) => {
      const board = await userIn(tx, 'rv-board', 'BOARD')
      const executor = await userIn(tx, 'rv-tech', 'TECH_ADMIN')
      const target = await userIn(tx, 'rv-target', 'TECH_ADMIN')
      const row = await tx.userRole.findFirstOrThrow({ where: { userId: target.id } })
      const decided = await revokeRoleInTx(tx, actor(board.id, 'BOARD'), target.id, row.id, { reason: 'Rời nhóm vận hành' }, OPTIONS)
      expect(decided.kind).toBe('decision')
      expect((await tx.userRole.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('ACTIVE')
      await executeDecisionInTx(tx, actor(executor.id, 'TECH_ADMIN'), decided.id, OPTIONS)
      expect((await tx.userRole.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('REVOKED')

      const another = await grantRoleInTx(tx, actor(board.id, 'BOARD'), target.id, { role: 'TECH_ADMIN', expiresAt: until.toISOString(), reason: 'Quay lại' }, OPTIONS)
      await cancelDecisionInTx(tx, actor(board.id, 'BOARD'), another.id, { reason: 'Đổi ý' }, OPTIONS)
      expect((await tx.roleDecision.findUniqueOrThrow({ where: { id: another.id } })).status).toBe('CANCELLED')
    })
  })

  it('with ENFORCE_PRIVILEGED_MINIMUM, revoking BOARD below 2 active holders is refused (409)', async () => {
    await isolated(new Date(Date.now() + 90 * DAY), async (tx) => {
      await tx.userRole.updateMany({ where: { role: 'BOARD', status: 'ACTIVE' }, data: { status: 'EXPIRED' } })
      const a = await userIn(tx, 'min-a', 'BOARD')
      const b = await userIn(tx, 'min-b', 'BOARD')
      const row = await tx.userRole.findFirstOrThrow({ where: { userId: b.id } })
      await expect(
        revokeRoleInTx(tx, actor(a.id, 'BOARD'), b.id, row.id, { reason: 'Thử ngưỡng' }, { enforcePrivilegedMinimum: true }),
      ).rejects.toMatchObject({ statusCode: 409 })
    })
  })
})

describe('góp ý review A6', () => {
  it('reads totpEnabledAt (B3) to decide whether a privileged role is ACTIVE at once', async () => {
    // Cơ sở dữ liệu hiện chưa có cột của B3: coi như chưa bật 2 lớp, không lỗi transaction.
    await isolated(null, async (tx) => {
      const user = await userIn(tx, 'totp-none')
      expect(await hasTwoFactorEnrolled(tx, user.id)).toBe(false)
    })
    // Khi B3 đã thêm cột: đọc đúng giá trị (giả lập phản hồi của database).
    const fake = (exists: boolean, enabled: boolean) =>
      ({
        $queryRaw: async (strings: TemplateStringsArray) =>
          strings.join('').includes('information_schema') ? [{ exists }] : [{ enabled }],
      }) as unknown as Tx
    expect(await hasTwoFactorEnrolled(fake(true, true), 'u')).toBe(true)
    expect(await hasTwoFactorEnrolled(fake(true, false), 'u')).toBe(false)
    expect(await hasTwoFactorEnrolled(fake(false, true), 'u')).toBe(false)
  })

  it('stores the revoke reason separately from the grant reason', async () => {
    const target = await createUser('reason-target', 'DEPARTMENT_MANAGER', deptA.id)
    const row = await db.userRole.findFirstOrThrow({ where: { userId: target.id } })
    await call('POST', `/admin/accounts/${target.id}/roles/${row.id}/revoke`, tokens.board, { reason: 'Hết nhiệm kỳ ban' })
    const saved = await db.userRole.findUniqueOrThrow({ where: { id: row.id } })
    expect(saved).toMatchObject({ reason: 'test', revokeReason: 'Hết nhiệm kỳ ban', status: 'REVOKED' })
    const listed = await call('GET', `/admin/accounts/${target.id}/roles`, tokens.board)
    expect(listed.json().roles[0]).toMatchObject({ revokeReason: 'Hết nhiệm kỳ ban' })
  })

  it('refuses moving a manager to a department they already manage (409)', async () => {
    await isolated(null, async (tx) => {
      const board = await userIn(tx, 'move-board', 'BOARD')
      const target = await userIn(tx, 'move-twice')
      const base = { userId: target.id, role: 'DEPARTMENT_MANAGER' as const, status: 'ACTIVE' as const, startsAt: new Date(Date.now() - 1000), reason: 'test' }
      const first = await tx.userRole.create({ data: { ...base, departmentId: deptA.id } })
      await tx.userRole.create({ data: { ...base, departmentId: deptB.id } })
      await expect(
        changeDepartmentInTx(tx, actor(board.id, 'BOARD'), target.id, first.id, { departmentId: deptB.id, reason: 'Gộp ban' }, OPTIONS),
      ).rejects.toMatchObject({ statusCode: 409 })
    })
  })
})

describe('góp ý review A6 — lần 2', () => {
  const roleRow = (userId: string, role: 'BOARD' | 'TECH_ADMIN' | 'DEPARTMENT_MANAGER') =>
    db.userRole.findFirstOrThrow({ where: { userId, role, status: { in: ['PENDING', 'ACTIVE'] } } })
  const deniedLogs = (targetId: string) => db.auditLog.findMany({ where: { targetId, action: 'auth.denied', result: 'FAILURE' } })

  it('gives an ACTIVE role at once (and signs old sessions out) when the person already set up two-factor', async () => {
    // Cột totpEnabledAt của B3 chưa có trên main: thêm tạm trong transaction (DDL của Postgres rollback được).
    await isolated(new Date(Date.now() + 90 * DAY), async (tx) => {
      await tx.$executeRaw`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpEnabledAt" TIMESTAMP(3)`
      const board = await userIn(tx, 'totp-board', 'BOARD')
      const target = await userIn(tx, 'totp-target')
      await tx.$executeRaw`UPDATE "users" SET "totpEnabledAt" = NOW() WHERE "id" = ${target.id}`
      await tx.session.create({ data: { userId: target.id, tokenHash: `totp-${tag}` } })
      expect(await hasTwoFactorEnrolled(tx, target.id)).toBe(true)

      const until = (await tx.siteSetting.findFirstOrThrow()).termEndsAt!
      const granted = await grantRoleInTx(tx, actor(board.id, 'BOARD'), target.id, { role: 'BOARD', expiresAt: until.toISOString(), reason: 'Gia hạn nhiệm kỳ' }, OPTIONS)
      expect(granted).toMatchObject({ kind: 'role', status: 'ACTIVE' })
      expect(await tx.session.count({ where: { userId: target.id, revokedAt: null } })).toBe(0)
    })
  })

  it('GET /admin/access-control: BOARD and TECH_ADMIN see the queue; managers and members get 403', async () => {
    for (const token of [tokens.board, tokens.tech]) {
      const response = await call('GET', '/admin/access-control', token)
      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({ pending: expect.any(Array), recent: expect.any(Array) })
    }
    for (const token of [tokens.manager, tokens.member]) expect((await call('GET', '/admin/access-control', token)).statusCode).toBe(403)
  })

  it('executes a TECH_ADMIN revoke decision over HTTP, then refuses to cancel it (409); only BOARD may cancel (403)', async () => {
    const target = await createUser('http-dual', 'TECH_ADMIN')
    const row = await roleRow(target.id, 'TECH_ADMIN')
    const decided = await call('POST', `/admin/accounts/${target.id}/roles/${row.id}/revoke`, tokens.board, { reason: 'Rời nhóm vận hành' })
    expect(decided.statusCode).toBe(202)
    const decisionId = decided.json().id

    expect((await call('POST', `/admin/access-control/${decisionId}/execute`, tokens.board)).statusCode).toBe(403)
    const executed = await call('POST', `/admin/access-control/${decisionId}/execute`, tokens.tech)
    expect(executed.statusCode).toBe(200)
    expect(executed.json()).toMatchObject({ status: 'EXECUTED', userRoleId: row.id })
    expect((await db.userRole.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('REVOKED')

    expect((await call('POST', `/admin/access-control/${decisionId}/cancel`, tokens.tech, { reason: 'Không được hủy' })).statusCode).toBe(403)
    expect((await call('POST', `/admin/access-control/${decisionId}/cancel`, tokens.board, { reason: 'Đã muộn' })).statusCode).toBe(409)
  })

  it('cancels a pending decision over HTTP (204), and a second cancel is 409', async () => {
    const target = await createUser('http-cancel', 'TECH_ADMIN')
    const row = await roleRow(target.id, 'TECH_ADMIN')
    const decisionId = (await call('POST', `/admin/accounts/${target.id}/roles/${row.id}/revoke`, tokens.board, { reason: 'Thử hủy' })).json().id
    expect((await call('POST', `/admin/access-control/${decisionId}/cancel`, tokens.board, { reason: 'Đổi ý' })).statusCode).toBe(204)
    expect((await db.roleDecision.findUniqueOrThrow({ where: { id: decisionId } })).status).toBe('CANCELLED')
    expect((await call('POST', `/admin/access-control/${decisionId}/cancel`, tokens.board, { reason: 'Lần hai' })).statusCode).toBe(409)
    expect((await db.userRole.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('ACTIVE')
  })

  it('execute and cancel pressed at the same time: exactly one wins and the record matches it', async () => {
    const target = await createUser('race-dual', 'TECH_ADMIN')
    const row = await roleRow(target.id, 'TECH_ADMIN')
    const decisionId = (await call('POST', `/admin/accounts/${target.id}/roles/${row.id}/revoke`, tokens.board, { reason: 'Thử song song' })).json().id
    const [executed, cancelled] = await Promise.all([
      call('POST', `/admin/access-control/${decisionId}/execute`, tokens.tech),
      call('POST', `/admin/access-control/${decisionId}/cancel`, tokens.board, { reason: 'Song song' }),
    ])
    expect([executed.statusCode, cancelled.statusCode].sort()).toEqual(executed.statusCode === 200 ? [200, 409] : [204, 409])
    const decision = await db.roleDecision.findUniqueOrThrow({ where: { id: decisionId } })
    const saved = await db.userRole.findUniqueOrThrow({ where: { id: row.id } })
    expect(decision.status).toBe(executed.statusCode === 200 ? 'EXECUTED' : 'CANCELLED')
    expect(saved.status).toBe(executed.statusCode === 200 ? 'REVOKED' : 'ACTIVE')
    expect(await db.auditLog.count({ where: { targetId: target.id, action: 'role.revoke', metadata: { path: ['stage'], equals: 'executed' } } })).toBe(executed.statusCode === 200 ? 1 : 0)
  })

  it('revoke and change-department: TECH_ADMIN and managers get 403; nobody may change their own roles (403, audited)', async () => {
    const target = await createUser('deny-target', 'DEPARTMENT_MANAGER', deptA.id)
    const row = await roleRow(target.id, 'DEPARTMENT_MANAGER')
    for (const token of [tokens.tech, tokens.manager]) {
      expect((await call('POST', `/admin/accounts/${target.id}/roles/${row.id}/revoke`, token, { reason: 'Không có quyền' })).statusCode).toBe(403)
      expect((await call('POST', `/admin/accounts/${target.id}/roles/${row.id}/change-department`, token, { departmentId: deptB.id, reason: 'Không có quyền' })).statusCode).toBe(403)
    }
    const own = await roleRow(boardUser.id, 'BOARD')
    expect((await call('POST', `/admin/accounts/${boardUser.id}/roles/${own.id}/revoke`, tokens.board, { reason: 'Tự thu hồi' })).statusCode).toBe(403)
    expect((await call('POST', `/admin/accounts/${boardUser.id}/roles/${own.id}/change-department`, tokens.board, { departmentId: deptB.id, reason: 'Tự đổi ban' })).statusCode).toBe(403)
    expect((await deniedLogs(boardUser.id)).length).toBeGreaterThanOrEqual(2)
    expect((await db.userRole.findUniqueOrThrow({ where: { id: own.id } })).status).toBe('ACTIVE')
  })

  it('audits a BR-21 refusal (BOARD + TECH_ADMIN) outside the rolled-back transaction', async () => {
    let targetId = ''
    const until = new Date(Date.now() + 90 * DAY)
    await isolated(until, async (tx) => {
      const target = await userIn(tx, 'br21-target', 'BOARD')
      targetId = target.id
      await expect(
        grantRoleInTx(tx, actor(boardUser.id, 'BOARD'), target.id, { role: 'TECH_ADMIN', expiresAt: until.toISOString(), reason: 'Thử leo quyền' }, OPTIONS),
      ).rejects.toMatchObject({ statusCode: 409 })
    })
    const logs = await deniedLogs(targetId)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ actorId: boardUser.id, category: 'SECURITY' })
    expect(logs[0]!.metadata).toMatchObject({ rule: 'BR-21' })
  })

  it('re-checks the term end and the expiry when executing a GRANT decision (409)', async () => {
    const until = new Date(Date.now() + 90 * DAY)
    await isolated(until, async (tx) => {
      const board = await userIn(tx, 'term-board', 'BOARD')
      const executor = await userIn(tx, 'term-tech', 'TECH_ADMIN')
      const target = await userIn(tx, 'term-target')
      const decided = await grantRoleInTx(tx, actor(board.id, 'BOARD'), target.id, { role: 'TECH_ADMIN', expiresAt: until.toISOString(), reason: 'Thêm người' }, OPTIONS)
      // BOARD rút ngắn nhiệm kỳ sau khi ghi quyết định.
      await tx.siteSetting.updateMany({ data: { termEndsAt: new Date(Date.now() + 30 * DAY) } })
      await expect(executeDecisionInTx(tx, actor(executor.id, 'TECH_ADMIN'), decided.id, OPTIONS)).rejects.toMatchObject({ statusCode: 409 })
      // Quyết định đã quá ngày hết hạn của vai trò.
      await tx.siteSetting.updateMany({ data: { termEndsAt: until } })
      await expect(
        executeDecisionInTx(tx, actor(executor.id, 'TECH_ADMIN'), decided.id, { ...OPTIONS, now: new Date(until.getTime() + DAY) }),
      ).rejects.toMatchObject({ statusCode: 409 })
      expect(await tx.userRole.count({ where: { userId: target.id } })).toBe(0)
    })
  })

  it('with ENFORCE_PRIVILEGED_MINIMUM, executing a TECH_ADMIN revoke below 2 other holders is refused (409)', async () => {
    await isolated(new Date(Date.now() + 90 * DAY), async (tx) => {
      await tx.userRole.updateMany({ where: { role: 'TECH_ADMIN', status: 'ACTIVE' }, data: { status: 'EXPIRED' } })
      const board = await userIn(tx, 'mint-board', 'BOARD')
      const executor = await userIn(tx, 'mint-exec', 'TECH_ADMIN')
      const target = await userIn(tx, 'mint-target', 'TECH_ADMIN')
      const row = await tx.userRole.findFirstOrThrow({ where: { userId: target.id } })
      const decided = await revokeRoleInTx(tx, actor(board.id, 'BOARD'), target.id, row.id, { reason: 'Thử ngưỡng' }, OPTIONS)
      await expect(
        executeDecisionInTx(tx, actor(executor.id, 'TECH_ADMIN'), decided.id, { enforcePrivilegedMinimum: true }),
      ).rejects.toMatchObject({ statusCode: 409 })
      expect((await tx.userRole.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('ACTIVE')
    })
  })

  it('deactivating an account cancels its pending decisions and records the revoke reason', async () => {
    const target = await createUser('leave-dual', 'TECH_ADMIN')
    const row = await roleRow(target.id, 'TECH_ADMIN')
    const decisionId = (await call('POST', `/admin/accounts/${target.id}/roles/${row.id}/revoke`, tokens.board, { reason: 'Sắp nghỉ' })).json().id
    const { updatedAt } = await db.user.findUniqueOrThrow({ where: { id: target.id } })
    const response = await call('POST', `/admin/accounts/${target.id}/deactivate`, tokens.board, { reason: 'Ngừng tham gia CLB', updatedAt: updatedAt.toISOString() })
    expect(response.statusCode).toBe(204)
    expect((await db.roleDecision.findUniqueOrThrow({ where: { id: decisionId } })).status).toBe('CANCELLED')
    expect(await db.userRole.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: 'REVOKED', revokeReason: 'Ngừng tham gia CLB' })
  })

  it('TECH_ADMIN sees only the TECH_ADMIN part of an account’s role history', async () => {
    const target = await createUser('mixed-view', 'DEPARTMENT_MANAGER', deptA.id)
    await db.userRole.create({ data: { userId: target.id, role: 'TECH_ADMIN', status: 'ACTIVE', startsAt: new Date(Date.now() - 1000), reason: 'test' } })
    const byBoard = (await call('GET', `/admin/accounts/${target.id}/roles`, tokens.board)).json()
    const byTech = (await call('GET', `/admin/accounts/${target.id}/roles`, tokens.tech)).json()
    expect(byBoard.roles.map((role: { role: string }) => role.role).sort()).toEqual(['DEPARTMENT_MANAGER', 'TECH_ADMIN'])
    expect(byTech.roles.map((role: { role: string }) => role.role)).toEqual(['TECH_ADMIN'])
  })
})

import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { Prisma } from '../../db/generated/client.js'
import { hashPassword } from '../../lib/password.js'
import type { AuthUser } from '../auth/rbac.js'
import { SESSION_COOKIE } from '../auth/session.js'
import { cancelDecisionInTx, executeDecisionInTx, grantRoleInTx, revokeRoleInTx } from './roles.js'

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

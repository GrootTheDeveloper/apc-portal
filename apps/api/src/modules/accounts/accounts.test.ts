import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { hashPassword } from '../../lib/password.js'
import { SESSION_COOKIE } from '../auth/session.js'
import { assertPrivilegedMinimum, deactivateAccount, generateTemporaryPassword } from './service.js'

// A5 — quản lý tài khoản, test với Postgres thật.
const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const origin = { origin: config.WEB_URL }
const PASSWORD = 'mat-khau-test-tai-khoan-a5'
const tag = randomUUID().slice(0, 8)
const userIds: string[] = []
const departmentIds: string[] = []
let passwordHash: string
let ip = 0
const tokens: Record<'board' | 'tech' | 'manager' | 'member', string> = { board: '', tech: '', manager: '', member: '' }

async function createUser(name: string, role?: 'BOARD' | 'TECH_ADMIN' | 'DEPARTMENT_MANAGER', departmentId?: string) {
  const user = await db.user.create({
    data: {
      username: `${name}-${tag}`,
      email: `${name}-${tag}@test.local`,
      passwordHash,
      fullName: `Người dùng ${name}`,
      status: 'ACTIVE',
      mustChangePassword: false,
      departmentId: departmentId ?? null,
    },
  })
  userIds.push(user.id)
  if (role) {
    await db.userRole.create({
      data: { userId: user.id, role, departmentId: role === 'DEPARTMENT_MANAGER' ? (departmentId ?? null) : null, status: 'ACTIVE', startsAt: new Date(Date.now() - 1000), reason: 'test' },
    })
  }
  return user
}

async function login(username: string, password = PASSWORD) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { username, password },
    headers: origin,
    remoteAddress: `10.5.0.${++ip % 250}`,
  })
  return { status: response.statusCode, token: response.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? '' }
}

// Thao tác đổi trạng thái bắt buộc gửi `updatedAt` của bản đang xem (STATE-09). Test không tự ghi `updatedAt`
// thì helper đọc bản mới nhất, giống trang chi tiết vừa tải xong.
const STATEFUL_ACTION = /^\/admin\/accounts\/([^/]+)\/(lock|unlock|reset-password|deactivate)$/

async function call(method: 'GET' | 'POST', url: string, token: string, payload?: Record<string, unknown>) {
  const match = STATEFUL_ACTION.exec(url)
  let body = payload
  const id = match?.[1]
  if (id && payload && !('updatedAt' in payload)) {
    const user = await db.user.findUnique({ where: { id }, select: { updatedAt: true } })
    if (user) body = { ...payload, updatedAt: user.updatedAt.toISOString() }
  }
  return app.inject({
    method,
    url,
    cookies: token ? { [SESSION_COOKIE]: token } : {},
    headers: origin,
    ...(body ? { payload: body } : {}),
  })
}
const me = (token: string) => call('GET', '/auth/me', token)

let departmentA: { id: string }
let archived: { id: string }

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD)
  await app.ready()
  departmentA = await db.department.create({ data: { name: 'Ban A5', code: `a5-${tag}` } })
  archived = await db.department.create({ data: { name: 'Ban cũ', code: `a5-old-${tag}`, status: 'ARCHIVED' } })
  departmentIds.push(departmentA.id, archived.id)

  const board = await createUser('board', 'BOARD')
  const tech = await createUser('tech', 'TECH_ADMIN')
  const manager = await createUser('manager', 'DEPARTMENT_MANAGER', departmentA.id)
  const member = await createUser('member', undefined, departmentA.id)
  tokens.board = (await login(board.username)).token
  tokens.tech = (await login(tech.username)).token
  tokens.manager = (await login(manager.username)).token
  tokens.member = (await login(member.username)).token
})

afterAll(async () => {
  const created = await db.user.findMany({ where: { username: { endsWith: `-${tag}` } }, select: { id: true } })
  const ids = [...new Set([...userIds, ...created.map((user) => user.id)])]
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { targetId: { in: ids } }] } })
  await db.session.deleteMany({ where: { userId: { in: ids } } })
  await db.userRole.deleteMany({ where: { userId: { in: ids } } })
  await db.user.deleteMany({ where: { id: { in: ids } } })
  await db.department.deleteMany({ where: { id: { in: departmentIds } } })
  await app.close()
  await db.$disconnect()
})

describe('who can reach /admin/accounts', () => {
  it('blocks members and department managers (403) and lets BOARD, TECH_ADMIN list accounts', async () => {
    expect((await call('GET', '/admin/accounts', tokens.member)).statusCode).toBe(403)
    expect((await call('GET', '/admin/accounts', tokens.manager)).statusCode).toBe(403)
    expect((await call('GET', '/admin/accounts', '')).statusCode).toBe(401)
    expect((await call('GET', '/admin/accounts', tokens.board)).statusCode).toBe(200)
    expect((await call('GET', '/admin/accounts', tokens.tech)).statusCode).toBe(200)
  })

  it('shows BOARD business fields and TECH_ADMIN technical fields only', async () => {
    const query = `/admin/accounts?q=member-${tag}`
    const [boardRow] = (await call('GET', query, tokens.board)).json().items
    const [techRow] = (await call('GET', query, tokens.tech)).json().items
    expect(boardRow).toMatchObject({ username: `member-${tag}`, email: `member-${tag}@test.local` })
    expect(boardRow).not.toHaveProperty('failedLoginAttempts')
    expect(techRow).toMatchObject({ username: `member-${tag}`, activeSessions: 1, failedLoginAttempts: 0 })
    expect(techRow).not.toHaveProperty('email')
  })

  it('returns 404 for an unknown account', async () => {
    expect((await call('GET', '/admin/accounts/khong-ton-tai', tokens.board)).statusCode).toBe(404)
  })
})

describe('create account', () => {
  it('creates a PENDING_ACTIVATION account with MEMBER only and shows the temporary password once', async () => {
    const response = await call('POST', '/admin/accounts', tokens.board, {
      username: `New-${tag}`,
      email: `new-${tag}@test.local`,
      fullName: 'Thành viên mới',
      departmentId: departmentA.id,
    })
    expect(response.statusCode).toBe(201)
    const { user, temporaryPassword } = response.json()
    expect(temporaryPassword).toMatch(/^[\w]{5}(-[\w]{5}){3}$/)

    const saved = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { roles: true } })
    expect(saved).toMatchObject({ username: `new-${tag}`, status: 'PENDING_ACTIVATION', mustChangePassword: true, isTemporaryPassword: true })
    expect(saved.roles).toEqual([])
    expect(saved.temporaryPasswordExpiresAt!.getTime() - Date.now()).toBeGreaterThan(71 * 3600 * 1000)

    // Không xuất hiện lại ở API chi tiết, nhật ký.
    const detail = await call('GET', `/admin/accounts/${user.id}`, tokens.board)
    expect(detail.body).not.toContain(temporaryPassword)
    const logs = await db.auditLog.findMany({ where: { targetId: user.id } })
    expect(logs.map((log) => log.action)).toContain('account.create')
    expect(JSON.stringify(logs)).not.toContain(temporaryPassword)

    // Đăng nhập được bằng mật khẩu tạm, nhưng chỉ để kích hoạt (A4).
    const session = await login(`new-${tag}`, temporaryPassword)
    expect(session.status).toBe(200)
    expect((await me(session.token)).json()).toMatchObject({ status: 'PENDING_ACTIVATION' })
  })

  it('rejects an archived department (422), duplicates (409) and anyone but BOARD (403)', async () => {
    const base = { fullName: 'Ai đó', email: `dup-${tag}@test.local` }
    expect(
      (await call('POST', '/admin/accounts', tokens.board, { ...base, username: `old-${tag}`, departmentId: archived.id })).statusCode,
    ).toBe(422)
    expect((await call('POST', '/admin/accounts', tokens.board, { ...base, username: `member-${tag}` })).statusCode).toBe(409)
    expect((await call('POST', '/admin/accounts', tokens.tech, { ...base, username: `x-${tag}` })).statusCode).toBe(403)
  })
})

describe('lock, unlock, temporary password, deactivate', () => {
  it('signs out a locked user at the next request; after unlock the user must sign in again', async () => {
    const target = await createUser('lock-me')
    const userToken = (await login(target.username)).token
    expect((await me(userToken)).statusCode).toBe(200)

    expect((await call('POST', `/admin/accounts/${target.id}/lock`, tokens.board, { reason: 'Nghi lộ mật khẩu' })).statusCode).toBe(204)
    expect((await me(userToken)).statusCode).toBe(401)
    expect((await login(target.username)).status).toBe(401)

    // Mở khóa ACTIVE → 409 chỉ khi chưa khóa; ở đây hợp lệ.
    expect((await call('POST', `/admin/accounts/${target.id}/unlock`, tokens.board, { reason: 'Đã xác minh' })).statusCode).toBe(204)
    expect((await me(userToken)).statusCode).toBe(401) // phiên cũ không được khôi phục
    expect((await login(target.username)).status).toBe(200)
    // Bước sai sơ đồ: mở khóa tài khoản đang hoạt động.
    expect((await call('POST', `/admin/accounts/${target.id}/unlock`, tokens.board, { reason: 'Lần hai' })).statusCode).toBe(409)
  })

  it('requires a reason for lock, unlock, temporary password and deactivate (422)', async () => {
    const target = await createUser('no-reason')
    for (const action of ['lock', 'unlock', 'reset-password', 'deactivate']) {
      expect((await call('POST', `/admin/accounts/${target.id}/${action}`, tokens.board, {})).statusCode).toBe(422)
      expect((await call('POST', `/admin/accounts/${target.id}/${action}`, tokens.board, { reason: '  ' })).statusCode).toBe(422)
    }
  })

  it('lets TECH_ADMIN lock only with an incident id, and records it', async () => {
    const target = await createUser('incident')
    const url = `/admin/accounts/${target.id}/lock`
    expect((await call('POST', url, tokens.tech, { reason: 'Đăng nhập lạ' })).statusCode).toBe(422)
    expect((await call('POST', url, tokens.tech, { reason: 'Đăng nhập lạ', incidentId: 'SU-CO-1' })).statusCode).toBe(422)
    expect((await call('POST', url, tokens.tech, { reason: 'Đăng nhập lạ', incidentId: 'INC-20261027-01' })).statusCode).toBe(204)
    const log = await db.auditLog.findFirstOrThrow({ where: { targetId: target.id, action: 'account.lock' } })
    expect(log).toMatchObject({ incidentId: 'INC-20261027-01', category: 'SECURITY' })
    // TECH_ADMIN không mở khóa, không cấp mật khẩu, không ngừng hoạt động.
    for (const action of ['unlock', 'reset-password', 'deactivate']) {
      expect((await call('POST', `/admin/accounts/${target.id}/${action}`, tokens.tech, { reason: 'Thử' })).statusCode).toBe(403)
    }
  })

  it('never lets anyone lock or deactivate their own account (403)', async () => {
    const board = await db.user.findFirstOrThrow({ where: { username: `board-${tag}` } })
    for (const action of ['lock', 'deactivate']) {
      expect((await call('POST', `/admin/accounts/${board.id}/${action}`, tokens.board, { reason: 'Tự khóa' })).statusCode).toBe(403)
    }
  })

  it('issues a new temporary password once and signs the user out everywhere', async () => {
    const target = await createUser('reset')
    const userToken = (await login(target.username)).token
    const response = await call('POST', `/admin/accounts/${target.id}/reset-password`, tokens.board, { reason: 'Quên mật khẩu' })
    expect(response.statusCode).toBe(200)
    const { temporaryPassword } = response.json()
    expect((await me(userToken)).statusCode).toBe(401)
    expect((await login(target.username)).status).toBe(401)
    const next = await login(target.username, temporaryPassword)
    expect((await me(next.token)).json()).toMatchObject({ mustChangePassword: true })
    const logs = await db.auditLog.findMany({ where: { targetId: target.id } })
    expect(JSON.stringify(logs)).not.toContain(temporaryPassword)
  })

  it('deactivating revokes every management role and every session', async () => {
    const target = await createUser('leaving', 'DEPARTMENT_MANAGER', departmentA.id)
    await db.userRole.create({
      data: { userId: target.id, role: 'BOARD', status: 'PENDING', startsAt: new Date(), reason: 'test' },
    })
    const userToken = (await login(target.username)).token
    const response = await call('POST', `/admin/accounts/${target.id}/deactivate`, tokens.board, { reason: 'Ngừng tham gia' })
    expect(response.statusCode).toBe(204)

    const saved = await db.user.findUniqueOrThrow({ where: { id: target.id }, include: { roles: true } })
    expect(saved.status).toBe('INACTIVE')
    expect(saved.deactivatedAt).not.toBeNull()
    expect(saved.roles.map((role) => role.status)).toEqual(['REVOKED', 'REVOKED'])
    expect((await me(userToken)).statusCode).toBe(401)
    expect((await call('POST', `/admin/accounts/${target.id}/deactivate`, tokens.board, { reason: 'Lần hai' })).statusCode).toBe(409)
  })

  it('refuses a stale form (409) when updatedAt no longer matches', async () => {
    const target = await createUser('stale')
    const response = await call('POST', `/admin/accounts/${target.id}/lock`, tokens.board, {
      reason: 'Form cũ',
      updatedAt: new Date(target.updatedAt.getTime() - 60_000).toISOString(),
    })
    expect(response.statusCode).toBe(409)
  })

  it('lets BOARD and TECH_ADMIN revoke all sessions of an account', async () => {
    const target = await createUser('sessions')
    const userToken = (await login(target.username)).token
    const response = await call('POST', `/admin/accounts/${target.id}/revoke-sessions`, tokens.tech, {})
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ revokedSessions: 1 })
    expect((await me(userToken)).statusCode).toBe(401)
    expect((await call('POST', `/admin/accounts/${target.id}/revoke-sessions`, tokens.manager, {})).statusCode).toBe(403)
  })
})

describe('góp ý review A5', () => {
  it('lock and deactivate pressed at the same time never end as INACTIVE-then-LOCKED', async () => {
    for (let round = 0; round < 3; round++) {
      const target = await createUser(`race-${round}`)
      const updatedAt = target.updatedAt.toISOString() // cả hai quản trị viên mở cùng một bản
      const [lock, deactivate] = await Promise.all([
        call('POST', `/admin/accounts/${target.id}/lock`, tokens.board, { reason: 'Khóa cùng lúc', updatedAt }),
        call('POST', `/admin/accounts/${target.id}/deactivate`, tokens.board, { reason: 'Ngừng cùng lúc', updatedAt }),
      ])
      expect([lock.statusCode, deactivate.statusCode]).toContain(204)
      for (const response of [lock, deactivate]) expect([204, 409]).toContain(response.statusCode)
      const saved = await db.user.findUniqueOrThrow({ where: { id: target.id } })
      // Ngừng hoạt động thành công thì kết quả cuối luôn là INACTIVE, không bao giờ bị khóa đè lên.
      expect(saved.status).toBe(deactivate.statusCode === 204 ? 'INACTIVE' : 'LOCKED')
    }
  })

  it('does not search accounts by email (the query sits in the URL, OPS-11)', async () => {
    const byEmail = await call('GET', `/admin/accounts?q=${encodeURIComponent(`member-${tag}@test.local`)}`, tokens.board)
    expect(byEmail.json().items).toEqual([])
    const byName = await call('GET', `/admin/accounts?q=member-${tag}`, tokens.board)
    expect(byName.json().items).toHaveLength(1)
  })

  it('signs in with the username in any letter case', async () => {
    expect((await login(`MEMBER-${tag}`.toUpperCase())).status).toBe(200)
  })

  it('does not touch updatedAt on a normal sign-in, so an open admin form stays valid', async () => {
    const target = await createUser('quiet-login')
    const before = await db.user.findUniqueOrThrow({ where: { id: target.id }, select: { updatedAt: true } })
    expect((await login(target.username)).status).toBe(200)
    expect((await login(target.username)).status).toBe(200)
    const after = await db.user.findUniqueOrThrow({ where: { id: target.id }, select: { updatedAt: true } })
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime())
    const lock = await call('POST', `/admin/accounts/${target.id}/lock`, tokens.board, { reason: 'Bản cũ vẫn hợp lệ', updatedAt: before.updatedAt.toISOString() })
    expect(lock.statusCode).toBe(204)
  })

  it('requires updatedAt for lock, unlock, temporary password and deactivate (422)', async () => {
    const target = await createUser('no-version')
    for (const action of ['lock', 'unlock', 'reset-password', 'deactivate']) {
      const response = await call('POST', `/admin/accounts/${target.id}/${action}`, tokens.board, { reason: 'Thiếu phiên bản', updatedAt: undefined })
      expect(response.statusCode).toBe(422)
    }
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).status).toBe('ACTIVE')
  })

  it('refuses invalid transitions with 409: lock a LOCKED or INACTIVE account, reset the password of an INACTIVE one', async () => {
    const locked = await createUser('already-locked')
    await db.user.update({ where: { id: locked.id }, data: { status: 'LOCKED' } })
    expect((await call('POST', `/admin/accounts/${locked.id}/lock`, tokens.board, { reason: 'Khóa lần hai' })).statusCode).toBe(409)

    const inactive = await createUser('already-inactive')
    await db.user.update({ where: { id: inactive.id }, data: { status: 'INACTIVE', deactivatedAt: new Date() } })
    expect((await call('POST', `/admin/accounts/${inactive.id}/lock`, tokens.board, { reason: 'Khóa người đã nghỉ' })).statusCode).toBe(409)
    expect((await call('POST', `/admin/accounts/${inactive.id}/reset-password`, tokens.board, { reason: 'Cấp lại' })).statusCode).toBe(409)
    expect((await db.user.findUniqueOrThrow({ where: { id: inactive.id } })).isTemporaryPassword).toBe(false)
  })

  it('never lets BOARD unlock or reset the password of their own account (403)', async () => {
    const board = await db.user.findFirstOrThrow({ where: { username: `board-${tag}` } })
    for (const action of ['unlock', 'reset-password']) {
      expect((await call('POST', `/admin/accounts/${board.id}/${action}`, tokens.board, { reason: 'Tự thao tác' })).statusCode).toBe(403)
    }
  })

  it('GET /admin/accounts/:id: BOARD and TECH_ADMIN read it, members and department managers get 403', async () => {
    const target = await db.user.findFirstOrThrow({ where: { username: `member-${tag}` } })
    expect((await call('GET', `/admin/accounts/${target.id}`, tokens.board)).statusCode).toBe(200)
    expect((await call('GET', `/admin/accounts/${target.id}`, tokens.tech)).statusCode).toBe(200)
    expect((await call('GET', `/admin/accounts/${target.id}`, tokens.member)).statusCode).toBe(403)
    expect((await call('GET', `/admin/accounts/${target.id}`, tokens.manager)).statusCode).toBe(403)
  })

  it('GET /admin/accounts/departments: BOARD gets active departments only; others get 403', async () => {
    const response = await call('GET', '/admin/accounts/departments', tokens.board)
    expect(response.statusCode).toBe(200)
    const ids = response.json().map((department: { id: string }) => department.id)
    expect(ids).toContain(departmentA.id)
    expect(ids).not.toContain(archived.id)
    for (const token of [tokens.tech, tokens.manager, tokens.member]) {
      expect((await call('GET', '/admin/accounts/departments', token)).statusCode).toBe(403)
    }
    expect((await call('GET', '/admin/accounts/departments', '')).statusCode).toBe(401)
  })
})

describe('privileged minimum (RP-06, RP-07) with ENFORCE_PRIVILEGED_MINIMUM', () => {
  // Chạy trong transaction rồi rollback để không đụng dữ liệu BOARD thật trong database.
  async function inIsolation(check: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<void>) {
    const rollback = new Error('rollback')
    await db
      .$transaction(async (tx) => {
        // Chặn file test khác ghi user_roles đến khi rollback, để trạng thái "trống" không bị chen vào.
        await tx.$executeRaw`LOCK TABLE "user_roles" IN SHARE ROW EXCLUSIVE MODE`
        await tx.userRole.updateMany({ where: { role: 'BOARD', status: 'ACTIVE' }, data: { status: 'EXPIRED' } })
        await check(tx)
        throw rollback
      })
      .catch((error) => {
        if (error !== rollback) throw error
      })
  }

  async function boardIn(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], name: string) {
    const user = await tx.user.create({
      data: { username: `${name}-${tag}`, email: `${name}-${tag}@test.local`, passwordHash, fullName: name, status: 'ACTIVE' },
    })
    await tx.userRole.create({ data: { userId: user.id, role: 'BOARD', status: 'ACTIVE', startsAt: new Date(Date.now() - 1000), reason: 'test' } })
    return user
  }

  it('refuses (409) when locking or deactivating would leave fewer than 2 active BOARD', async () => {
    await inIsolation(async (tx) => {
      const a = await boardIn(tx, 'min-a')
      await boardIn(tx, 'min-b')
      await expect(assertPrivilegedMinimum(tx, a.id)).rejects.toMatchObject({ statusCode: 409 })
      await expect(
        deactivateAccount(tx, { service: 'test' }, a.id, { reason: 'test', enforcePrivilegedMinimum: true }),
      ).rejects.toMatchObject({ statusCode: 409 })
    })
  })

  it('allows it when at least 2 other BOARD stay active', async () => {
    await inIsolation(async (tx) => {
      const a = await boardIn(tx, 'ok-a')
      await boardIn(tx, 'ok-b')
      await boardIn(tx, 'ok-c')
      await expect(assertPrivilegedMinimum(tx, a.id)).resolves.toBeUndefined()
    })
  })
})

it('generates readable random temporary passwords', () => {
  const passwords = new Set(Array.from({ length: 200 }, generateTemporaryPassword))
  expect(passwords.size).toBe(200)
  for (const password of passwords) expect(password).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{5}(-[a-km-zA-HJ-NP-Z2-9]{5}){3}$/)
})

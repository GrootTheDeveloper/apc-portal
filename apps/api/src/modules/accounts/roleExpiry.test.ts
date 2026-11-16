import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { hashPassword } from '../../lib/password.js'
import { SESSION_COOKIE } from '../auth/session.js'
import { runRoleExpiry } from './roleExpiry.js'

// O6 — vai trò hết hạn và cảnh báo 30/7 ngày. Test chỉ đếm email/audit gắn với dòng vai trò do chính test tạo
// (refId/targetId), nên không phụ thuộc dữ liệu khác trong DB.
const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const origin = { origin: config.WEB_URL }
const PASSWORD = 'mat-khau-test-vai-tro-o6'
const tag = randomUUID().slice(0, 8)
const DAY = 24 * 3600 * 1000
const userIds: string[] = []
const roleIds: string[] = []
let passwordHash: string
let ip = 0
let board: { id: string; username: string }
let tech: { id: string; username: string }
let member: { id: string; username: string }
const tokens = { board: '', tech: '', member: '' }

async function createUser(name: string, role?: 'BOARD' | 'TECH_ADMIN') {
  const user = await db.user.create({
    data: { username: `${name}-${tag}`, email: `${name}-${tag}@test.local`, passwordHash, fullName: name, status: 'ACTIVE', mustChangePassword: false },
  })
  userIds.push(user.id)
  if (role) await db.userRole.create({ data: { userId: user.id, role, status: 'ACTIVE', startsAt: new Date(Date.now() - 1000), reason: 'test' } })
  return user
}

/** Dòng TECH_ADMIN của một người giữ mới, hết hạn sau `days` ngày kể từ `base`. */
async function createExpiring(name: string, days: number, base = new Date()) {
  const holder = await createUser(name)
  const row = await db.userRole.create({
    data: { userId: holder.id, role: 'TECH_ADMIN', status: 'ACTIVE', startsAt: new Date(base.getTime() - DAY), expiresAt: new Date(base.getTime() + days * DAY), reason: 'test' },
  })
  roleIds.push(row.id)
  return { holder, row }
}

async function login(username: string) {
  const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { username, password: PASSWORD }, headers: origin, remoteAddress: `10.7.0.${++ip % 250}` })
  return response.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? ''
}

const get = (url: string, token: string) => app.inject({ method: 'GET', url, cookies: token ? { [SESSION_COOKIE]: token } : {}, headers: origin })

const deliveries = (refId: string) => db.notificationDelivery.findMany({ where: { type: 'ROLE_EXPIRING', refType: 'USER_ROLE', refId }, select: { recipient: true } })


beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD)
  await app.ready()
  board = await createUser('board', 'BOARD')
  tech = await createUser('tech', 'TECH_ADMIN')
  member = await createUser('member')
  tokens.board = await login(board.username)
  tokens.tech = await login(tech.username)
  tokens.member = await login(member.username)
})

afterAll(async () => {
  await db.notificationDelivery.deleteMany({ where: { refType: 'USER_ROLE', refId: { in: roleIds } } })
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { targetId: { in: [...userIds, ...roleIds] } }] } })
  await db.session.deleteMany({ where: { userId: { in: userIds } } })
  await db.userRole.deleteMany({ where: { userId: { in: userIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await app.close()
  await db.$disconnect()
})

describe('role-expiry job', () => {
  it('moves an overdue ACTIVE role to EXPIRED with one SERVICE audit row, once', async () => {
    const { row } = await createExpiring('overdue', -1 / 24) // hết hạn 1 giờ trước
    await runRoleExpiry(undefined, [row.id])
    await runRoleExpiry(undefined, [row.id])
    expect((await db.userRole.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('EXPIRED')
    const logs = await db.auditLog.findMany({ where: { targetId: row.id, action: 'role.expire' } })
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ actorType: 'SERVICE', serviceName: 'role-expiry', actorId: null })
  })

  it('warns once at 29 days: holder plus every active BOARD, none on the second run', async () => {
    const now = new Date()
    const { holder, row } = await createExpiring('warn30', 29, now)
    await runRoleExpiry(now, [row.id])
    // Các file test khác có thể tạo/xóa BOARD cùng lúc, nên không so cả tập người nhận mà kiểm:
    // không trùng, có người giữ, có BOARD của file này, và lượt chạy thứ hai không tạo thêm.
    const first = (await deliveries(row.id)).map((d) => d.recipient)
    expect(new Set(first).size).toBe(first.length)
    expect(first).toContain(holder.email)
    expect(first).toContain(`board-${tag}@test.local`)
    await runRoleExpiry(now, [row.id])
    expect(await deliveries(row.id)).toHaveLength(first.length)
  })

  it('sends the 7-day round after the 30-day one, once', async () => {
    const now = new Date()
    const { row } = await createExpiring('warn7', 29, now)
    await runRoleExpiry(now, [row.id])
    const size = (await deliveries(row.id)).length
    expect(size).toBeGreaterThan(0)
    const later = new Date(now.getTime() + 23 * DAY) // còn 6 ngày
    await runRoleExpiry(later, [row.id])
    expect(await deliveries(row.id)).toHaveLength(size * 2)
    await runRoleExpiry(later, [row.id])
    expect(await deliveries(row.id)).toHaveLength(size * 2)
    expect(await db.userRole.findUniqueOrThrow({ where: { id: row.id }, select: { warnedLevel: true } })).toEqual({ warnedLevel: 7 })
  })

  it('a row first seen at 6 days gets only the 7-day round, once', async () => {
    const now = new Date()
    const { holder, row } = await createExpiring('first7', 6, now)
    await runRoleExpiry(now, [row.id])
    const first = (await deliveries(row.id)).map((d) => d.recipient)
    expect(first).toContain(holder.email)
    await runRoleExpiry(now, [row.id])
    expect(await deliveries(row.id)).toHaveLength(first.length)
    expect(await db.userRole.findUniqueOrThrow({ where: { id: row.id }, select: { warnedLevel: true } })).toEqual({ warnedLevel: 7 })
  })

  it('warns again at the 30-day mark of a renewed expiry date', async () => {
    const now = new Date()
    const { row } = await createExpiring('renew', 29, now)
    await runRoleExpiry(now, [row.id])
    const size = (await deliveries(row.id)).length
    expect(size).toBeGreaterThan(0)
    await db.userRole.update({ where: { id: row.id }, data: { expiresAt: new Date(now.getTime() + 100 * DAY) } })
    await runRoleExpiry(new Date(now.getTime() + 50 * DAY), [row.id]) // còn 50 ngày: chưa tới mốc
    expect(await deliveries(row.id)).toHaveLength(size)
    await runRoleExpiry(new Date(now.getTime() + 75 * DAY), [row.id]) // còn 25 ngày: báo lại mốc 30
    expect(await deliveries(row.id)).toHaveLength(size * 2)
  })
})

describe('GET /admin/accounts/expiring-roles', () => {
  it('lets BOARD see expiring privileged roles and hides one once an ACTIVE successor exists', async () => {
    const { holder, row } = await createExpiring('listed', 20)
    const ids = async () => ((await get('/admin/accounts/expiring-roles', tokens.board)).json().items as { id: string }[]).map((item) => item.id)
    const response = await get('/admin/accounts/expiring-roles', tokens.board)
    expect(response.statusCode).toBe(200)
    expect(response.json().items).toContainEqual(expect.objectContaining({ id: row.id, userId: holder.id, role: 'TECH_ADMIN' }))

    const successor = await createUser('successor')
    await db.userRole.create({ data: { userId: successor.id, role: 'TECH_ADMIN', status: 'ACTIVE', startsAt: new Date(), expiresAt: new Date(Date.now() + 200 * DAY), reason: 'kế nhiệm' } })
    expect(await ids()).not.toContain(row.id)
  })

  it('rejects anonymous, member and TECH_ADMIN callers', async () => {
    expect((await get('/admin/accounts/expiring-roles', '')).statusCode).toBe(401)
    expect((await get('/admin/accounts/expiring-roles', tokens.member)).statusCode).toBe(403)
    expect((await get('/admin/accounts/expiring-roles', tokens.tech)).statusCode).toBe(403)
  })
})

import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { conflict } from '../../lib/errors.js'
import { hashPassword } from '../../lib/password.js'
import { SESSION_COOKIE } from '../auth/session.js'

// ENFORCE_PRIVILEGED_MINIMUM qua route (RP-06, RP-07). Số BOARD thật trong database phụ thuộc file test khác,
// nên ở đây thay `assertPrivilegedMinimum` bằng hàm giả để kiểm: route có gọi kiểm tra khi bật cờ, và 409 của
// kiểm tra chặn thao tác. Logic đếm tối thiểu được test riêng với database thật trong accounts.test.ts.
const minimum = vi.hoisted(() => vi.fn())
vi.mock('./privileged.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./privileged.js')>()),
  assertPrivilegedMinimum: minimum,
}))

const enforced = buildApp(loadConfig({ NODE_ENV: 'test', ENFORCE_PRIVILEGED_MINIMUM: 'true' }))
const relaxed = buildApp(loadConfig({ NODE_ENV: 'test' }))
const origin = { origin: loadConfig({ NODE_ENV: 'test' }).WEB_URL }
const PASSWORD = 'mat-khau-test-nguong-toi-thieu'
const tag = randomUUID().slice(0, 8)
const userIds: string[] = []
let passwordHash: string
let boardToken = ''

async function createUser(name: string, role?: 'BOARD') {
  const user = await db.user.create({
    data: { username: `${name}-${tag}`, email: `${name}-${tag}@test.local`, passwordHash, fullName: name, status: 'ACTIVE', mustChangePassword: false },
  })
  userIds.push(user.id)
  if (role) {
    await db.userRole.create({ data: { userId: user.id, role, status: 'ACTIVE', startsAt: new Date(Date.now() - 1000), reason: 'test' } })
  }
  return user
}

const act = (app: typeof enforced, action: 'lock' | 'deactivate', target: { id: string; updatedAt: Date }) =>
  app.inject({
    method: 'POST',
    url: `/admin/accounts/${target.id}/${action}`,
    cookies: { [SESSION_COOKIE]: boardToken },
    headers: origin,
    payload: { reason: 'Kiểm ngưỡng tối thiểu', updatedAt: target.updatedAt.toISOString() },
  })

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD)
  await Promise.all([enforced.ready(), relaxed.ready()])
  const board = await createUser('enforce-board', 'BOARD')
  const login = await enforced.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { username: board.username, password: PASSWORD },
    headers: origin,
    remoteAddress: '10.6.0.1',
  })
  boardToken = login.cookies.find((cookie) => cookie.name === SESSION_COOKIE)?.value ?? ''
})

beforeEach(() => {
  minimum.mockReset()
})

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { targetId: { in: userIds } }] } })
  await db.session.deleteMany({ where: { userId: { in: userIds } } })
  await db.userRole.deleteMany({ where: { userId: { in: userIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await Promise.all([enforced.close(), relaxed.close()])
  await db.$disconnect()
})

describe('ENFORCE_PRIVILEGED_MINIMUM on /admin/accounts', () => {
  it('refuses /lock and /deactivate with 409 when the minimum check fails, and changes nothing', async () => {
    minimum.mockRejectedValue(conflict('Không thực hiện được: production phải còn ít nhất 2 ban chủ nhiệm đang hoạt động.'))
    const target = await createUser('enforce-target', 'BOARD')
    for (const action of ['lock', 'deactivate'] as const) {
      const response = await act(enforced, action, target)
      expect(response.statusCode).toBe(409)
      expect(response.json().message).toContain('ít nhất 2')
    }
    expect(minimum).toHaveBeenCalledWith(expect.anything(), target.id)
    const saved = await db.user.findUniqueOrThrow({ where: { id: target.id }, include: { roles: true } })
    expect(saved.status).toBe('ACTIVE')
    expect(saved.roles.map((role) => role.status)).toEqual(['ACTIVE'])
  })

  it('lets the action through when the check passes', async () => {
    minimum.mockResolvedValue(undefined)
    const target = await createUser('enforce-ok', 'BOARD')
    expect((await act(enforced, 'lock', target)).statusCode).toBe(204)
    expect(minimum).toHaveBeenCalledTimes(1)
  })

  it('skips the check entirely when the flag is off (development, before launch)', async () => {
    const target = await createUser('relaxed-target', 'BOARD')
    expect((await act(relaxed, 'deactivate', target)).statusCode).toBe(204)
    expect(minimum).not.toHaveBeenCalled()
  })
})

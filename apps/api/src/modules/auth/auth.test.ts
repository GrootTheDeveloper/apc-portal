import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { hashPassword } from '../../lib/password.js'
import { hashToken, SESSION_COOKIE, SESSION_IDLE_MS } from './session.js'

// Test tích hợp với Postgres thật: tự tạo tài khoản bằng db + hashPassword, không chờ dữ liệu mẫu D1.
const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const ORIGIN = config.WEB_URL
const PASSWORD = 'mat-khau-test-du-15-ky-tu'
const tag = randomUUID().slice(0, 8)
const createdUserIds: string[] = []
let passwordHash: string
let ipCounter = 0

async function createUser(
  name: string,
  data: { status?: 'ACTIVE' | 'LOCKED' | 'INACTIVE' | 'PENDING_ACTIVATION'; temporaryExpired?: boolean } = {},
) {
  const user = await db.user.create({
    data: {
      username: `${name}-${tag}`,
      email: `${name}-${tag}@test.local`,
      passwordHash,
      fullName: `Người dùng ${name}`,
      status: data.status ?? 'ACTIVE',
      mustChangePassword: false,
      ...(data.temporaryExpired
        ? { isTemporaryPassword: true, temporaryPasswordExpiresAt: new Date(Date.now() - 1000) }
        : {}),
    },
  })
  createdUserIds.push(user.id)
  return user
}

// Mỗi lần gọi một IP khác để giới hạn theo IP của route không ảnh hưởng test khác.
const nextIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`

function login(username: string, password: string, options: { origin?: string | null; ip?: string } = {}) {
  const origin = options.origin === undefined ? ORIGIN : options.origin
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { username, password },
    remoteAddress: options.ip ?? nextIp(),
    headers: origin ? { origin } : {},
  })
}

const sessionToken = (response: Awaited<ReturnType<typeof login>>) =>
  response.cookies.find((cookie) => cookie.name === SESSION_COOKIE)?.value

const me = (token?: string) =>
  app.inject({ method: 'GET', url: '/auth/me', cookies: token ? { [SESSION_COOKIE]: token } : {} })

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD)
  await app.ready()
})

afterAll(async () => {
  await db.session.deleteMany({ where: { userId: { in: createdUserIds } } })
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  await app.close()
  await db.$disconnect()
})

describe('POST /auth/login', () => {
  it('logs in, sets an HttpOnly apc_session cookie and stores only the token hash', async () => {
    const user = await createUser('ok')
    const response = await login(user.username, PASSWORD)

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body).toMatchObject({
      id: user.id,
      username: user.username,
      status: 'ACTIVE',
      roles: [{ role: 'MEMBER', departmentId: null }],
      mustChangePassword: false,
    })
    expect(JSON.stringify(body)).not.toContain('argon2')

    const cookie = response.cookies.find((item) => item.name === SESSION_COOKIE)
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' })
    const token = cookie?.value ?? ''
    expect(token).toMatch(/^[\w-]{43}$/) // 32 byte base64url

    const sessions = await db.session.findMany({ where: { userId: user.id } })
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.tokenHash).toBe(hashToken(token))
    expect(sessions[0]?.tokenHash).not.toBe(token)
  })

  it('answers a wrong password and an unknown username with the same generic 401', async () => {
    const user = await createUser('wrong')
    const wrongPassword = await login(user.username, 'mat-khau-sai-hoan-toan')
    const unknownUser = await login(`khong-ton-tai-${tag}`, PASSWORD)

    expect(wrongPassword.statusCode).toBe(401)
    expect(wrongPassword.json()).toEqual({ error: 'unauthenticated', message: 'Sai tên đăng nhập hoặc mật khẩu.' })
    expect(unknownUser.body).toBe(wrongPassword.body)
    expect(sessionToken(wrongPassword)).toBeUndefined()
  })

  it('makes the account wait 15 minutes after 5 wrong passwords in a row', async () => {
    const user = await createUser('lockout')
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect((await login(user.username, `sai-mat-khau-lan-${attempt}`)).statusCode).toBe(401)
    }
    // Đúng mật khẩu vẫn bị chặn trong thời gian chờ, và trả lời y hệt sai mật khẩu (SEC-08).
    const blocked = await login(user.username, PASSWORD)
    expect(blocked.statusCode).toBe(401)
    expect(blocked.json()).toEqual({ error: 'unauthenticated', message: 'Sai tên đăng nhập hoặc mật khẩu.' })
    expect(sessionToken(blocked)).toBeUndefined()

    const locked = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(locked.lockoutUntil!.getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000)

    // Hết 15 phút thì đăng nhập lại được và bộ đếm về 0.
    await db.user.update({ where: { id: user.id }, data: { lockoutUntil: new Date(Date.now() - 1000) } })
    expect((await login(user.username, PASSWORD)).statusCode).toBe(200)
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).failedLoginAttempts).toBe(0)
  })

  it('refuses locked and inactive accounts with the generic message', async () => {
    for (const status of ['LOCKED', 'INACTIVE'] as const) {
      const user = await createUser(status.toLowerCase(), { status })
      const response = await login(user.username, PASSWORD)
      expect(response.statusCode).toBe(401)
      expect(response.json().message).toBe('Sai tên đăng nhập hoặc mật khẩu.')
    }
  })

  it('refuses a temporary password older than 72 hours', async () => {
    const user = await createUser('expired', { status: 'PENDING_ACTIVATION', temporaryExpired: true })
    const response = await login(user.username, PASSWORD)
    expect(response.statusCode).toBe(401)
    expect(response.json().message).toContain('Liên hệ Ban Chủ nhiệm')
  })

  it('rejects requests without the web Origin (CSRF) and invalid bodies', async () => {
    const user = await createUser('origin')
    expect((await login(user.username, PASSWORD, { origin: null })).statusCode).toBe(403)
    expect((await login(user.username, PASSWORD, { origin: 'https://evil.example' })).statusCode).toBe(403)

    const empty = await app.inject({ method: 'POST', url: '/auth/login', payload: {}, headers: { origin: ORIGIN } })
    expect(empty.statusCode).toBe(422)

    // Mọi POST/PUT/PATCH/DELETE đều phải có Origin đúng, kể cả khi có phiên hợp lệ.
    const token = sessionToken(await login(user.username, PASSWORD))
    const logout = await app.inject({ method: 'POST', url: '/auth/logout', cookies: { [SESSION_COOKIE]: token ?? '' } })
    expect(logout.statusCode).toBe(403)
    expect((await me(token)).statusCode).toBe(200)
  })

  it('limits login attempts per IP address', async () => {
    const ip = nextIp()
    const statuses: number[] = []
    for (let attempt = 0; attempt < 21; attempt++) {
      statuses.push((await login(`ip-${tag}-${attempt}`, PASSWORD, { ip })).statusCode)
    }
    expect(statuses.slice(0, 20).every((status) => status === 401)).toBe(true)
    expect(statuses[20]).toBe(429)
  })
})

describe('GET /auth/me', () => {
  it('returns the signed-in user with roles from user_roles', async () => {
    const user = await createUser('me')
    await db.userRole.create({
      data: { userId: user.id, role: 'BOARD', status: 'ACTIVE', startsAt: new Date(Date.now() - 1000), reason: 'test' },
    })
    const token = sessionToken(await login(user.username, PASSWORD))

    const response = await me(token)
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      id: user.id,
      username: user.username,
      status: 'ACTIVE',
      mustChangePassword: false,
      roles: [
        { role: 'MEMBER', departmentId: null },
        { role: 'BOARD', departmentId: null },
      ],
    })
    // Tạm đến B3: phiên mới coi như đã qua 2 lớp.
    expect((await db.session.findFirstOrThrow({ where: { userId: user.id } })).twoFactorVerified).toBe(true)

    // Phiên chưa qua 2 lớp thì mất BOARD (RP-13).
    await db.session.updateMany({ where: { userId: user.id }, data: { twoFactorVerified: false } })
    expect((await me(token)).json().roles).toEqual([{ role: 'MEMBER', departmentId: null }])
    await db.userRole.deleteMany({ where: { userId: user.id } })
  })

  it('returns 401 without a session, with an unknown token or after 8 idle hours', async () => {
    expect((await me()).statusCode).toBe(401)
    expect((await me('token-gia-mao')).statusCode).toBe(401)

    const user = await createUser('idle')
    const token = sessionToken(await login(user.username, PASSWORD))
    await db.session.updateMany({
      where: { userId: user.id },
      data: { lastActiveAt: new Date(Date.now() - SESSION_IDLE_MS - 60_000) },
    })
    const response = await me(token)
    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBe('unauthenticated')
  })

  it('rejects an existing session as soon as the account is locked, and revokes it', async () => {
    const user = await createUser('locked-later')
    const token = sessionToken(await login(user.username, PASSWORD))
    expect((await me(token)).statusCode).toBe(200)

    await db.user.update({ where: { id: user.id }, data: { status: 'LOCKED' } })
    expect((await me(token)).statusCode).toBe(401)
    const session = await db.session.findFirstOrThrow({ where: { userId: user.id } })
    expect(session.revokedAt).not.toBeNull()
  })
})

describe('POST /auth/logout', () => {
  it('revokes the session and clears the cookie', async () => {
    const user = await createUser('logout')
    const token = sessionToken(await login(user.username, PASSWORD))

    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { [SESSION_COOKIE]: token ?? '' },
      headers: { origin: ORIGIN },
    })
    expect(response.statusCode).toBe(204)
    expect(response.cookies.find((cookie) => cookie.name === SESSION_COOKIE)?.value).toBe('')
    expect((await me(token)).statusCode).toBe(401)
  })

  it('returns 401 without a session', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/logout', headers: { origin: ORIGIN } })
    expect(response.statusCode).toBe(401)
  })
})

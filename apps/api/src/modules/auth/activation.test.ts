import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { passwordProblems } from './password-policy.js'
import { SESSION_COOKIE } from './session.js'

// A4 — kích hoạt tài khoản và đổi mật khẩu, test với Postgres thật.
const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const headers = { origin: config.WEB_URL }
const TEMP = 'mat-khau-tam-thoi-du-dai'
const NEW = 'cau mat khau moi cua toi 2026'
const tag = randomUUID().slice(0, 8)
const createdUserIds: string[] = []
let tempHash: string
let ip = 0

async function createUser(name: string, pending = true) {
  const user = await db.user.create({
    data: {
      username: `${name}-${tag}`,
      email: `${name}-${tag}@test.local`,
      passwordHash: tempHash,
      fullName: `Người dùng ${name}`,
      status: pending ? 'PENDING_ACTIVATION' : 'ACTIVE',
      mustChangePassword: pending,
      isTemporaryPassword: pending,
      temporaryPasswordExpiresAt: pending ? new Date(Date.now() + 72 * 3600 * 1000) : null,
    },
  })
  createdUserIds.push(user.id)
  return user
}

async function login(username: string, password: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { username, password },
    headers,
    remoteAddress: `10.9.0.${++ip}`,
  })
  return { status: response.statusCode, token: response.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? '' }
}

const post = (url: string, token: string, payload: object, withOrigin = true) =>
  app.inject({
    method: 'POST',
    url,
    payload,
    cookies: token ? { [SESSION_COOKIE]: token } : {},
    headers: withOrigin ? headers : {},
    remoteAddress: `10.9.1.${++ip % 250}`,
  })

const me = (token: string) => app.inject({ method: 'GET', url: '/auth/me', cookies: { [SESSION_COOKIE]: token } })
const issueMessages = (response: { json: () => { issues?: { message: string }[] } }) =>
  (response.json().issues ?? []).map((issue) => issue.message).join(' | ')

beforeAll(async () => {
  tempHash = await hashPassword(TEMP)
  await app.ready()
})

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } })
  await db.session.deleteMany({ where: { userId: { in: createdUserIds } } })
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  await app.close()
  await db.$disconnect()
})

describe('password policy (SEC-11)', () => {
  it('accepts long passphrases with spaces and Vietnamese, without forcing character mixes', () => {
    expect(passwordProblems('đây là cụm mật khẩu của tôi', 'member.a')).toEqual([])
    expect(passwordProblems(NEW, 'member.a')).toEqual([])
  })

  it('rejects short, too long, common, repetitive and username-based passwords', () => {
    expect(passwordProblems('a'.repeat(5) + 'bcdefghij', 'x').join()).toContain('ít nhất 15')
    expect(passwordProblems('x'.repeat(129), 'u').join()).toContain('tối đa 128')
    expect(passwordProblems('Password12345678', 'u').join()).toContain('phổ biến')
    expect(passwordProblems('abcabcabcabcabcabc', 'u').join()).toContain('phổ biến')
    expect(passwordProblems('member.a ngay hom nay', 'member.a').join()).toContain('tên đăng nhập')
  })
})

describe('POST /auth/activate', () => {
  it('keeps a pending account out of every other API until it changes the temporary password', async () => {
    const user = await createUser('pending-gate')
    const { status, token } = await login(user.username, TEMP)
    expect(status).toBe(200)
    // /auth/me vẫn dùng được (web cần biết phải chuyển sang /account/activate).
    expect((await me(token)).json()).toMatchObject({ status: 'PENDING_ACTIVATION', mustChangePassword: true })
    // API cần requireAuth: 403.
    const blocked = await post('/auth/change-password', token, { currentPassword: TEMP, newPassword: NEW, confirmPassword: NEW })
    expect(blocked.statusCode).toBe(403)
  })

  it('rejects a weak, mismatched or unchanged password with 422 naming the unmet rule, and changes nothing', async () => {
    const user = await createUser('weak')
    const { token } = await login(user.username, TEMP)
    const cases = [
      [{ newPassword: '12345678901234', confirmPassword: '12345678901234' }, 'ít nhất 15'],
      [{ newPassword: 'matkhau123456789', confirmPassword: 'matkhau123456789' }, 'phổ biến'],
      [{ newPassword: NEW, confirmPassword: `${NEW}!` }, 'không khớp'],
      [{ newPassword: TEMP, confirmPassword: TEMP }, 'khác mật khẩu tạm'],
    ] as const
    for (const [payload, expected] of cases) {
      const response = await post('/auth/activate', token, payload)
      expect(response.statusCode).toBe(422)
      expect(issueMessages(response)).toContain(expected)
    }
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(after.status).toBe('PENDING_ACTIVATION')
    expect(await verifyPassword(after.passwordHash, TEMP)).toBe(true)
  })

  it('activates, revokes the old session and issues a new one', async () => {
    const user = await createUser('activate')
    const { token: oldToken } = await login(user.username, TEMP)

    const response = await post('/auth/activate', oldToken, { newPassword: NEW, confirmPassword: NEW })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'ACTIVE', mustChangePassword: false })
    const newToken = response.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? ''
    expect(newToken).not.toBe(oldToken)

    expect((await me(oldToken)).statusCode).toBe(401)
    expect((await me(newToken)).statusCode).toBe(200)

    const saved = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(saved).toMatchObject({ status: 'ACTIVE', mustChangePassword: false, isTemporaryPassword: false })
    expect(saved.passwordChangedAt).not.toBeNull()
    expect((await login(user.username, TEMP)).status).toBe(401)
    expect((await login(user.username, NEW)).status).toBe(200)
  })

  it('refuses an account that is already active (409), a request without Origin (403) and no session (401)', async () => {
    const active = await createUser('already', false)
    const { token } = await login(active.username, TEMP)
    expect((await post('/auth/activate', token, { newPassword: NEW, confirmPassword: NEW })).statusCode).toBe(409)
    expect((await post('/auth/activate', token, { newPassword: NEW, confirmPassword: NEW }, false)).statusCode).toBe(403)
    expect((await post('/auth/activate', '', { newPassword: NEW, confirmPassword: NEW })).statusCode).toBe(401)
  })
})

describe('góp ý review A4', () => {
  it('blocks an ACTIVE account that still has a temporary password from every API except activation (403)', async () => {
    const user = await createUser('active-temp', false)
    await db.user.update({ where: { id: user.id }, data: { mustChangePassword: true, isTemporaryPassword: true, temporaryPasswordExpiresAt: new Date(Date.now() + 3600_000) } })
    const { token } = await login(user.username, TEMP)
    expect((await me(token)).statusCode).toBe(200)
    const blocked = await post('/auth/change-password', token, { currentPassword: TEMP, newPassword: NEW, confirmPassword: NEW })
    expect(blocked.statusCode).toBe(403)
    const activated = await post('/auth/activate', token, { newPassword: NEW, confirmPassword: NEW })
    expect(activated.statusCode).toBe(200)
    expect(activated.json()).toMatchObject({ status: 'ACTIVE', mustChangePassword: false })
  })

  it('writes an audit row for activation and for a password change, without the password', async () => {
    const user = await createUser('audited')
    const first = await login(user.username, TEMP)
    const activated = await post('/auth/activate', first.token, { newPassword: NEW, confirmPassword: NEW })
    const token = activated.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? ''
    const NEWER = 'mot cau mat khau khac nua 2027'
    expect((await post('/auth/change-password', token, { currentPassword: NEW, newPassword: NEWER, confirmPassword: NEWER })).statusCode).toBe(204)

    const logs = await db.auditLog.findMany({ where: { targetId: user.id }, orderBy: { createdAt: 'asc' } })
    expect(logs.map((log) => log.action)).toEqual(expect.arrayContaining(['account.activate', 'account.change_password']))
    expect(logs.every((log) => log.actorId === user.id && log.category === 'SECURITY')).toBe(true)
    const dump = JSON.stringify(logs)
    for (const secret of [TEMP, NEW, NEWER]) expect(dump).not.toContain(secret)
  })

  it('normalizes passwords to NFC: set with decomposed accents, sign in with precomposed ones', async () => {
    const user = await createUser('nfc')
    const { token } = await login(user.username, TEMP)
    const decomposed = 'mật khẩu có dấu tiếng việt'.normalize('NFD')
    expect((await post('/auth/activate', token, { newPassword: decomposed, confirmPassword: decomposed })).statusCode).toBe(200)
    expect((await login(user.username, decomposed.normalize('NFC'))).status).toBe(200)
    expect((await login(user.username, decomposed)).status).toBe(200)
  })

  it('limits password attempts per session, so switching IP does not help (429)', async () => {
    const user = await createUser('limit', false)
    const { token } = await login(user.username, TEMP)
    const statuses: number[] = []
    for (let attempt = 0; attempt < 11; attempt++) {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        payload: { currentPassword: 'sai-mat-khau-hien-tai', newPassword: NEW, confirmPassword: NEW },
        cookies: { [SESSION_COOKIE]: token },
        headers,
        remoteAddress: `10.9.2.${attempt + 1}`, // mỗi lần một IP khác
      })
      statuses.push(response.statusCode)
    }
    expect(statuses.slice(0, 10).every((status) => status === 422)).toBe(true)
    expect(statuses[10]).toBe(429)
  })
})

describe('POST /auth/change-password', () => {
  it('signs out every other session but keeps the current one', async () => {
    const user = await createUser('change', false)
    const browserA = (await login(user.username, TEMP)).token
    const browserB = (await login(user.username, TEMP)).token

    const response = await post('/auth/change-password', browserA, {
      currentPassword: TEMP,
      newPassword: NEW,
      confirmPassword: NEW,
    })
    expect(response.statusCode).toBe(204)
    expect((await me(browserA)).statusCode).toBe(200)
    expect((await me(browserB)).statusCode).toBe(401)
    expect((await login(user.username, NEW)).status).toBe(200)
  })

  it('rejects a wrong current password (422) and keeps the old password working', async () => {
    const user = await createUser('wrong-current', false)
    const { token } = await login(user.username, TEMP)
    const response = await post('/auth/change-password', token, {
      currentPassword: 'khong-phai-mat-khau-hien-tai',
      newPassword: NEW,
      confirmPassword: NEW,
    })
    expect(response.statusCode).toBe(422)
    expect(issueMessages(response)).toContain('hiện tại không đúng')
    expect((await login(user.username, TEMP)).status).toBe(200)
    expect((await me(token)).statusCode).toBe(200)
  })

  it('rejects reusing the current password and requires a session', async () => {
    const user = await createUser('same', false)
    const { token } = await login(user.username, TEMP)
    const same = await post('/auth/change-password', token, { currentPassword: TEMP, newPassword: TEMP, confirmPassword: TEMP })
    expect(same.statusCode).toBe(422)
    expect((await post('/auth/change-password', '', { currentPassword: TEMP, newPassword: NEW, confirmPassword: NEW })).statusCode).toBe(401)
  })
})

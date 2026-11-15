import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { DeliveryStatus } from '../../db/generated/client.js'
import type { AuthUser } from '../auth/rbac.js'

// O3: trang theo dõi email. Test tích hợp với Postgres thật; mọi dòng gắn `tag` để dọn đúng phần của mình
// và để assertion không phụ thuộc dữ liệu khác trong database.
const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const tag = randomUUID().slice(0, 8)
const recipient = (name: string) => `${name}-${tag}@test.local`
const INCIDENT = 'INC-20261115-01'
const REASON = 'Điều tra email không tới người nhận'

type Key = 'board' | 'managerA' | 'managerB' | 'member' | 'tech'
const users = {} as Record<Key, AuthUser>
const userIds: string[] = []
const departmentIds: string[] = []
let deptA = ''
let deptB = ''
const LEFT_FAILED = ['PENDING', 'SENDING', 'SENT', 'RETRY']
const ids = {} as Record<'a_failed' | 'a_sent' | 'a_retry' | 'b_failed' | 'club_failed', string>

app.addHook('onRequest', async (request) => {
  const key = request.headers['x-test-user'] as Key | undefined
  request.user = key ? (users[key] ?? null) : null
})

const call = (method: 'GET' | 'POST', url: string, user: Key | null, body?: unknown) =>
  app.inject({
    method,
    url,
    ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
    headers: { ...(method === 'POST' ? { origin: config.WEB_URL } : {}), ...(user ? { 'x-test-user': user } : {}) },
  })

const makeDelivery = (name: string, departmentId: string | null, status: DeliveryStatus, extra: { type?: string; attempts?: number; lastError?: string; nextAttemptAt?: Date } = {}) =>
  db.notificationDelivery
    .create({
      data: {
        type: extra.type ?? 'TEST', recipient: recipient(name), refType: 'USER', refId: `ref-${tag}-${name}`,
        departmentId, status, attempts: extra.attempts ?? 0, lastError: extra.lastError ?? null,
        nextAttemptAt: extra.nextAttemptAt ?? new Date(),
      },
      select: { id: true },
    })
    .then(({ id }) => id)

const row = (id: string) => db.notificationDelivery.findUniqueOrThrow({ where: { id } })
const auditOf = (action: string, targetId: string) => db.auditLog.findFirst({ where: { action, targetId }, orderBy: { createdAt: 'desc' } })

beforeAll(async () => {
  deptA = (await db.department.create({ data: { name: `Email A ${tag}`, code: `em-a-${tag}` } })).id
  deptB = (await db.department.create({ data: { name: `Email B ${tag}`, code: `em-b-${tag}` } })).id
  departmentIds.push(deptA, deptB)
  for (const key of ['board', 'managerA', 'managerB', 'member', 'tech'] as const) {
    const departmentId = key === 'managerA' ? deptA : key === 'managerB' ? deptB : null
    const user = await db.user.create({
      data: {
        username: `o3-${key}-${tag}`, email: `o3-${key}-${tag}@test.local`, passwordHash: 'khong-dung',
        fullName: `O3 ${key}`, status: 'ACTIVE', mustChangePassword: false, departmentId,
      },
    })
    userIds.push(user.id)
    const roles: AuthUser['roles'] = [{ role: 'MEMBER', departmentId }]
    if (key === 'board') roles.push({ role: 'BOARD', departmentId: null })
    if (key === 'tech') roles.push({ role: 'TECH_ADMIN', departmentId: null })
    if (key === 'managerA') roles.push({ role: 'DEPARTMENT_MANAGER', departmentId: deptA })
    if (key === 'managerB') roles.push({ role: 'DEPARTMENT_MANAGER', departmentId: deptB })
    users[key] = { id: user.id, departmentId, roles }
  }
  ids.a_failed = await makeDelivery('a-failed', deptA, 'FAILED', { attempts: 5, lastError: 'ECONNREFUSED 127.0.0.1:1025' })
  ids.a_sent = await makeDelivery('a-sent', deptA, 'SENT', { type: 'EVENT_REGISTRATION_CONFIRMED', attempts: 1 })
  ids.a_retry = await makeDelivery('a-retry', deptA, 'RETRY', { attempts: 2, nextAttemptAt: new Date(Date.now() + 3_600_000) })
  ids.b_failed = await makeDelivery('b-failed', deptB, 'FAILED', { attempts: 5 })
  ids.club_failed = await makeDelivery('club-failed', null, 'FAILED', { attempts: 5 })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  const deliveryIds = Object.values(ids)
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { targetId: { in: deliveryIds } }] } })
  await db.notificationDelivery.deleteMany({ where: { id: { in: deliveryIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await db.department.deleteMany({ where: { id: { in: departmentIds } } })
})

describe('GET /admin/email-deliveries', () => {
  it('trưởng ban chỉ thấy email của ban mình, kèm người nhận', async () => {
    const response = await call('GET', '/admin/email-deliveries?pageSize=100', 'managerA')
    expect(response.statusCode).toBe(200)
    const items = response.json().items as { id: string; recipient: string; department: { id: string } }[]
    expect(items.map((item) => item.id).sort()).toEqual([ids.a_failed, ids.a_sent, ids.a_retry].sort())
    expect(response.json().total).toBe(3)
    expect(items.every((item) => item.department.id === deptA)).toBe(true)
    expect(items.find((item) => item.id === ids.a_failed)?.recipient).toBe(recipient('a-failed'))
  })

  it('manager.a không thấy email của Ban B', async () => {
    const body = (await call('GET', '/admin/email-deliveries?pageSize=100', 'managerA')).body
    expect(body).not.toContain(ids.b_failed)
    expect(body).not.toContain(ids.club_failed)
  })

  it('BOARD thấy tất cả các ban và email không thuộc ban nào', async () => {
    const response = await call('GET', '/admin/email-deliveries?pageSize=100&status=FAILED', 'board')
    const found = (response.json().items as { id: string }[]).map((item) => item.id)
    expect(found).toEqual(expect.arrayContaining([ids.a_failed, ids.b_failed, ids.club_failed]))
  })

  it('lọc theo trạng thái, loại và khoảng thời gian; phân trang', async () => {
    const byStatus = await call('GET', '/admin/email-deliveries?status=RETRY', 'managerA')
    expect((byStatus.json().items as { id: string }[]).map((item) => item.id)).toEqual([ids.a_retry])

    const byType = await call('GET', '/admin/email-deliveries?type=EVENT_REGISTRATION_CONFIRMED', 'managerA')
    expect((byType.json().items as { id: string }[]).map((item) => item.id)).toEqual([ids.a_sent])

    const past = await call('GET', '/admin/email-deliveries?to=2020-01-01T00:00:00.000Z', 'managerA')
    expect(past.json()).toMatchObject({ items: [], total: 0 })
    const since = await call('GET', '/admin/email-deliveries?from=2020-01-01T00:00:00.000Z', 'managerA')
    expect(since.json().total).toBe(3)

    const paged = await call('GET', '/admin/email-deliveries?page=2&pageSize=2', 'managerA')
    expect(paged.json()).toMatchObject({ page: 2, pageSize: 2, total: 3 })
    expect(paged.json().items).toHaveLength(1)
  })

  it('bộ lọc sai trả 422', async () => {
    expect((await call('GET', '/admin/email-deliveries?status=KHAC', 'managerA')).statusCode).toBe(422)
  })

  it('không trả mã tham chiếu bản ghi gốc', async () => {
    const body = (await call('GET', '/admin/email-deliveries?pageSize=100', 'managerA')).body
    expect(body).not.toContain(`ref-${tag}`)
    expect(body).not.toContain('refId')
  })

  it.each([
    [null, 401],
    ['member', 403],
    ['tech', 403],
  ] as const)('người dùng %s bị từ chối %i', async (user, status) => {
    expect((await call('GET', '/admin/email-deliveries', user)).statusCode).toBe(status)
  })
})

describe('GET /admin/email-deliveries/:id', () => {
  it('trưởng ban xem được email của ban mình', async () => {
    const response = await call('GET', `/admin/email-deliveries/${ids.a_failed}`, 'managerA')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      id: ids.a_failed, type: 'TEST', status: 'FAILED', attempts: 5, recipient: recipient('a-failed'),
      lastError: 'ECONNREFUSED 127.0.0.1:1025', department: { id: deptA },
    })
  })

  it('mở thẳng link email của Ban B, email không thuộc ban nào hoặc id không có thì 404', async () => {
    for (const id of [ids.b_failed, ids.club_failed, 'khong-ton-tai']) {
      expect((await call('GET', `/admin/email-deliveries/${id}`, 'managerA')).statusCode).toBe(404)
    }
  })

  it('BOARD xem được email của mọi ban', async () => {
    expect((await call('GET', `/admin/email-deliveries/${ids.b_failed}`, 'board')).statusCode).toBe(200)
    expect((await call('GET', `/admin/email-deliveries/${ids.club_failed}`, 'board')).statusCode).toBe(200)
  })

  it.each([
    [null, 401],
    ['member', 403],
    ['tech', 403],
  ] as const)('người dùng %s bị từ chối %i', async (user, status) => {
    expect((await call('GET', `/admin/email-deliveries/${ids.a_failed}`, user)).statusCode).toBe(status)
  })
})

describe('POST /admin/email-deliveries/:id/retry', () => {
  it('BOARD gửi lại email FAILED: về PENDING, đặt lại số lần thử, ghi audit', async () => {
    const response = await call('POST', `/admin/email-deliveries/${ids.b_failed}/retry`, 'board', { reason: 'Đã sửa cấu hình SMTP' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'PENDING' })
    // Worker của file test khác có thể nhận ngay email vừa về PENDING, nên chỉ kiểm nó đã rời FAILED.
    expect(LEFT_FAILED).toContain((await row(ids.b_failed)).status)
    expect(await auditOf('email.resend', ids.b_failed)).toMatchObject({
      actorId: users.board.id, category: 'BUSINESS', result: 'SUCCESS', reason: 'Đã sửa cấu hình SMTP',
    })
  })

  it('BOARD gửi lại không cần lý do (form gửi chuỗi rỗng như giao diện)', async () => {
    const response = await call('POST', `/admin/email-deliveries/${ids.club_failed}/retry`, 'board', { reason: '', incidentId: '' })
    expect(response.statusCode).toBe(200)
    expect(LEFT_FAILED).toContain((await row(ids.club_failed)).status)
  })

  it('gửi lại email đang SENT (hay bất kỳ trạng thái nào khác FAILED) trả 409 và không đổi dữ liệu', async () => {
    // Dòng PENDING hẹn giờ ở tương lai: worker không nhận, nên trạng thái đứng yên trong lúc test.
    const pending = await makeDelivery('a-pending', deptA, 'PENDING', { nextAttemptAt: new Date(Date.now() + 3_600_000) })
    for (const id of [ids.a_sent, ids.a_retry, pending]) {
      const before = await row(id)
      const response = await call('POST', `/admin/email-deliveries/${id}/retry`, 'board', {})
      expect(response.statusCode).toBe(409)
      expect(response.json().error).toBe('conflict')
      expect(await row(id)).toMatchObject({ status: before.status, attempts: before.attempts })
    }
  })

  it('trưởng ban gọi API gửi lại nhận 403, email giữ nguyên', async () => {
    const response = await call('POST', `/admin/email-deliveries/${ids.a_failed}/retry`, 'managerA', {})
    expect(response.statusCode).toBe(403)
    expect(await row(ids.a_failed)).toMatchObject({ status: 'FAILED', attempts: 5 })
  })

  it('TECH_ADMIN thiếu mã sự cố, thiếu lý do hoặc mã sai dạng thì 422', async () => {
    for (const body of [{}, { reason: REASON }, { incidentId: INCIDENT }, { incidentId: 'INC-1', reason: REASON }]) {
      expect((await call('POST', `/admin/email-deliveries/${ids.a_failed}/retry`, 'tech', body)).statusCode).toBe(422)
    }
    expect((await row(ids.a_failed)).status).toBe('FAILED')
  })

  it('TECH_ADMIN gửi lại được khi kèm mã sự cố, audit SECURITY ghi incidentId', async () => {
    const response = await call('POST', `/admin/email-deliveries/${ids.a_failed}/retry`, 'tech', { incidentId: INCIDENT, reason: REASON })
    expect(response.statusCode).toBe(200)
    expect(await row(ids.a_failed)).toMatchObject({ status: 'PENDING', attempts: 0 })
    expect(await auditOf('email.resend', ids.a_failed)).toMatchObject({
      actorId: users.tech.id, category: 'SECURITY', incidentId: INCIDENT, reason: REASON,
    })
  })

  it.each([
    [null, 401],
    ['member', 403],
  ] as const)('người dùng %s bị từ chối %i', async (user, status) => {
    expect((await call('POST', `/admin/email-deliveries/${ids.a_sent}/retry`, user, {})).statusCode).toBe(status)
  })

  it('email không tồn tại trả 404', async () => {
    expect((await call('POST', '/admin/email-deliveries/khong-ton-tai/retry', 'board', {})).statusCode).toBe(404)
  })
})

describe('TECH_ADMIN xem metadata theo quyền INCIDENT', () => {
  it('POST /search trả metadata, không có người nhận, ghi audit SECURITY kèm incidentId', async () => {
    const response = await call('POST', '/admin/email-deliveries/search', 'tech', {
      incidentId: INCIDENT, reason: REASON, status: 'SENT', pageSize: 100,
    })
    expect(response.statusCode).toBe(200)
    const items = response.json().items as Record<string, unknown>[]
    const mine = items.find((item) => item.id === ids.a_sent)
    expect(mine).toMatchObject({ type: 'EVENT_REGISTRATION_CONFIRMED', status: 'SENT', attempts: 1 })
    expect(items.every((item) => !('recipient' in item))).toBe(true)
    expect(response.body).not.toContain(`@test.local`)
    const log = await db.auditLog.findFirst({
      where: { actorId: users.tech.id, action: 'system.incident_access', targetType: 'EMAIL_DELIVERY', targetId: null },
      orderBy: { createdAt: 'desc' },
    })
    expect(log).toMatchObject({ category: 'SECURITY', incidentId: INCIDENT, reason: REASON })
  })

  it('POST /:id/metadata trả metadata không có người nhận và ghi audit', async () => {
    const response = await call('POST', `/admin/email-deliveries/${ids.a_retry}/metadata`, 'tech', { incidentId: INCIDENT, reason: REASON })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ id: ids.a_retry, status: 'RETRY', attempts: 2 })
    expect(response.json()).not.toHaveProperty('recipient')
    expect(response.body).not.toContain('@test.local')
    expect(await auditOf('system.incident_access', ids.a_retry)).toMatchObject({ category: 'SECURITY', incidentId: INCIDENT })
  })

  it('thiếu hoặc sai mã sự cố, thiếu lý do thì 422; id không có thì 404', async () => {
    for (const body of [{}, { reason: REASON }, { incidentId: 'sai', reason: REASON }, { incidentId: INCIDENT }]) {
      expect((await call('POST', '/admin/email-deliveries/search', 'tech', body)).statusCode).toBe(422)
      expect((await call('POST', `/admin/email-deliveries/${ids.a_retry}/metadata`, 'tech', body)).statusCode).toBe(422)
    }
    expect((await call('POST', '/admin/email-deliveries/khong-ton-tai/metadata', 'tech', { incidentId: INCIDENT, reason: REASON })).statusCode).toBe(404)
  })

  it.each([
    [null, 401],
    ['member', 403],
    ['managerA', 403],
    ['board', 403],
  ] as const)('người dùng %s bị từ chối %i', async (user, status) => {
    const body = { incidentId: INCIDENT, reason: REASON }
    expect((await call('POST', '/admin/email-deliveries/search', user, body)).statusCode).toBe(status)
    expect((await call('POST', `/admin/email-deliveries/${ids.a_retry}/metadata`, user, body)).statusCode).toBe(status)
  })
})

import { randomUUID } from 'node:crypto'

import type { FastifyBaseLogger } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { AuthUser } from '../auth/rbac.js'
import { describeError, enqueueEmail, type Mailer, type OutgoingEmail, processEmailQueue } from './service.js'

// Test tích hợp với Postgres thật. Mọi dòng tạo ra có địa chỉ nhận đuôi `${tag}@test.local` để dọn đúng phần của mình.
const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const tag = randomUUID().slice(0, 8)
const recipient = (name: string) => `${name}-${tag}@test.local`
let userId: string
let users: Record<'tech' | 'member', AuthUser>

const error = vi.fn()
const log = { error } as unknown as FastifyBaseLogger

/** SMTP giả: ghi lại thư đã gửi; `failWith` để giả lập lỗi. */
function fakeMailer(options: { from?: string; failWith?: object; delayMs?: number } = {}) {
  const sent: OutgoingEmail[] = []
  const mailer: Mailer = {
    from: options.from ?? 'APC Portal <no-reply@apc.local>',
    send: async (email) => {
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs))
      if (options.failWith) throw Object.assign(new Error('Lỗi giả lập'), options.failWith)
      sent.push(email)
      return { messageId: email.messageId }
    },
  }
  return { mailer, sent }
}

const enqueue = (name: string) =>
  enqueueEmail(db, { type: 'TEST', to: recipient(name), refType: 'USER', refId: userId }).then(({ id }) => id)

const delivery = (id: string) => db.notificationDelivery.findUniqueOrThrow({ where: { id } })

/** Cho dòng đến hạn ngay, để chạy lượt thử kế tiếp mà không phải chờ. */
const makeDue = (id: string) =>
  db.notificationDelivery.update({ where: { id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } })

beforeAll(async () => {
  const user = await db.user.create({
    data: {
      username: `email-${tag}`,
      email: recipient('tech'),
      passwordHash: 'khong-dung',
      fullName: 'Nguyễn <script>alert(1)</script>',
      mustChangePassword: false,
    },
  })
  userId = user.id
  users = {
    tech: { id: userId, departmentId: null, roles: [{ role: 'MEMBER', departmentId: null }, { role: 'TECH_ADMIN', departmentId: null }] },
    member: { id: userId, departmentId: null, roles: [{ role: 'MEMBER', departmentId: null }] },
  }
  app.addHook('onRequest', async (request) => {
    const key = request.headers['x-test-user']
    request.user = key === 'tech' || key === 'member' ? users[key] : null
  })
  await app.ready()
})

beforeEach(() => {
  error.mockClear()
})

afterAll(async () => {
  await db.notificationDelivery.deleteMany({ where: { OR: [{ recipient: { endsWith: `${tag}@test.local` } }, { refId: userId }] } })
  await db.user.delete({ where: { id: userId } })
  await app.close()
})

describe('enqueueEmail', () => {
  it('thêm một dòng PENDING chỉ chứa tham chiếu, không có nội dung email', async () => {
    const row = await delivery(await enqueue('pending'))
    expect(row).toMatchObject({ status: 'PENDING', type: 'TEST', refType: 'USER', refId: userId, attempts: 0 })
    expect(Object.keys(row)).not.toEqual(expect.arrayContaining(['subject', 'html', 'text']))
  })

  it('transaction nghiệp vụ rollback thì không có email nào', async () => {
    await expect(
      db.$transaction(async (tx) => {
        await enqueueEmail(tx, { type: 'TEST', to: recipient('rollback'), refType: 'USER', refId: userId })
        throw new Error('nghiệp vụ lỗi')
      }),
    ).rejects.toThrow('nghiệp vụ lỗi')
    expect(await db.notificationDelivery.count({ where: { recipient: recipient('rollback') } })).toBe(0)
  })

  it('từ chối loại email không có mẫu hoặc địa chỉ sai', async () => {
    await expect(enqueueEmail(db, { type: 'KHONG_CO' as 'TEST', to: recipient('x'), refType: 'USER', refId: userId })).rejects.toThrow()
    await expect(enqueueEmail(db, { type: 'TEST', to: 'khong-phai-email', refType: 'USER', refId: userId })).rejects.toThrow()
  })
})

describe('processEmailQueue', () => {
  it('gửi email đến hạn, chuyển SENT, Message-ID sinh từ id dòng, tên người dùng được escape', async () => {
    const id = await enqueue('ok')
    const { mailer, sent } = fakeMailer()
    await processEmailQueue(mailer, log)

    const email = sent.find((item) => item.to === recipient('ok'))
    expect(email?.messageId).toBe(`<${id}@apc-portal>`)
    expect(email?.html).toContain('&#60;script&#62;')
    expect(email?.html).not.toContain('<script>')
    expect(await delivery(id)).toMatchObject({ status: 'SENT', attempts: 1, messageId: `${id}@apc-portal`, lastError: null })
  })

  it('lỗi tạm thời: RETRY với thời gian chờ 1, 5, 15, 60 phút, đến lần thứ 5 thì FAILED', async () => {
    const id = await enqueue('retry')
    const { mailer, sent } = fakeMailer({ failWith: { code: 'ECONNREFUSED' } })

    for (const [attempt, minutes] of [1, 5, 15, 60].entries()) {
      const before = Date.now()
      await processEmailQueue(mailer, log)
      const row = await delivery(id)
      expect(row).toMatchObject({ status: 'RETRY', attempts: attempt + 1, lockedAt: null })
      expect(row.nextAttemptAt.getTime() - before).toBeGreaterThanOrEqual(minutes * 60_000 - 1000)
      expect(row.lastError).toContain('ECONNREFUSED')
      await makeDue(id)
    }

    await processEmailQueue(mailer, log)
    expect(await delivery(id)).toMatchObject({ status: 'FAILED', attempts: 5 })
    expect(sent).toHaveLength(0)
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ deliveryId: id }), expect.any(String))
  })

  it('lỗi vĩnh viễn (SMTP 5xx) thì FAILED ngay, không thử lại', async () => {
    const id = await enqueue('reject')
    await processEmailQueue(fakeMailer({ failWith: { responseCode: 550 } }).mailer, log)
    expect(await delivery(id)).toMatchObject({ status: 'FAILED', attempts: 1 })
  })

  it('thiếu SMTP_FROM hoặc thiếu mẫu thì FAILED, ghi log lỗi, không gọi SMTP', async () => {
    const noConfig = await enqueue('no-from')
    const { mailer, sent } = fakeMailer({ from: '' })
    await processEmailQueue(mailer, log)
    expect(await delivery(noConfig)).toMatchObject({ status: 'FAILED', lastError: 'Thiếu cấu hình SMTP_FROM' })

    const { id: noTemplate } = await db.notificationDelivery.create({
      data: { type: 'MAU_DA_XOA', recipient: recipient('no-template'), refType: 'USER', refId: userId, nextAttemptAt: new Date() },
    })
    await processEmailQueue(mailer, log)
    expect(await delivery(noTemplate)).toMatchObject({ status: 'FAILED' })
    expect(sent).toHaveLength(0)
    for (const id of [noConfig, noTemplate]) {
      expect(error).toHaveBeenCalledWith(expect.objectContaining({ deliveryId: id }), expect.any(String))
    }
  })

  it('hai worker chạy cùng lúc không gửi trùng email nào', async () => {
    const ids = await Promise.all(['a', 'b', 'c', 'd', 'e', 'f'].map((name) => enqueue(`parallel-${name}`)))
    const { mailer, sent } = fakeMailer({ delayMs: 20 })
    await Promise.all([processEmailQueue(mailer, log), processEmailQueue(mailer, log)])

    const sentIds = sent.map((email) => email.messageId).filter((messageId) => ids.some((id) => messageId.includes(id)))
    expect(sentIds).toHaveLength(ids.length)
    expect(new Set(sentIds).size).toBe(ids.length)
  })

  it('nhận lại dòng kẹt ở SENDING quá 10 phút, bỏ qua dòng vừa nhận', async () => {
    const stuck = await enqueue('stuck')
    const fresh = await enqueue('fresh')
    await db.notificationDelivery.update({ where: { id: stuck }, data: { status: 'SENDING', attempts: 1, lockedAt: new Date(Date.now() - 11 * 60_000) } })
    await db.notificationDelivery.update({ where: { id: fresh }, data: { status: 'SENDING', attempts: 1, lockedAt: new Date(Date.now() - 60_000) } })

    await processEmailQueue(fakeMailer().mailer, log)
    expect(await delivery(stuck)).toMatchObject({ status: 'SENT', attempts: 2 })
    expect(await delivery(fresh)).toMatchObject({ status: 'SENDING', attempts: 1 })
  })
})

describe('describeError', () => {
  it('chỉ giữ dòng đầu, bỏ địa chỉ email', () => {
    const reason = describeError(Object.assign(new Error('550 <ai-do@example.com>: Recipient rejected\nchi tiết'), { responseCode: 550 }))
    expect(reason).toBe('550 550 <[email]>: Recipient rejected')
  })

  it('lấy lỗi con khi kết nối lỗi cả IPv4 lẫn IPv6 (AggregateError có message rỗng)', () => {
    const error = Object.assign(new AggregateError([new Error('connect ECONNREFUSED ::1:1025')], ''), { code: 'ESOCKET' })
    expect(describeError(error)).toBe('ESOCKET connect ECONNREFUSED ::1:1025')
  })
})

describe('POST /admin/email/test', () => {
  const send = (user?: 'tech' | 'member') =>
    app.inject({
      method: 'POST',
      url: '/admin/email/test',
      headers: { origin: config.WEB_URL, ...(user ? { 'x-test-user': user } : {}) },
    })

  it('TECH_ADMIN xếp một email thử tới chính địa chỉ của mình', async () => {
    const response = await send('tech')
    expect(response.statusCode).toBe(202)
    expect(await delivery(response.json().id)).toMatchObject({ type: 'TEST', recipient: recipient('tech'), status: 'PENDING' })
  })

  it.each([
    [undefined, 401],
    ['member', 403],
  ] as const)('người dùng %s bị từ chối %i', async (user, status) => {
    expect((await send(user)).statusCode).toBe(status)
  })
})

import type { FastifyBaseLogger } from 'fastify'
import nodemailer from 'nodemailer'
import { z } from 'zod'

import type { AppConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { Prisma } from '../../db/generated/client.js'
import { EMAIL_TYPES, templateFor, type RenderedEmail } from './templates.js'

const enqueueSchema = z.object({
  type: z.enum(EMAIL_TYPES),
  to: z.email(),
  refType: z.string().min(1),
  refId: z.string().min(1),
  departmentId: z.string().optional(),
})

/**
 * Xếp một email vào hàng đợi, chạy trong transaction của thao tác nghiệp vụ: rollback thì không có email nào.
 * Chỉ truyền tham chiếu tới bản ghi gốc; không truyền mã hồ sơ, mã đăng ký hay nội dung email (FLOW-26, OPS-11).
 *   await db.$transaction(async (tx) => {
 *     const application = await tx.membershipApplication.create({ ... })
 *     await enqueueEmail(tx, { type: '<mẫu của O2>', to: application.applicantEmail, refType: 'APPLICATION', refId: application.id })
 *   })
 * Không cần transaction thì truyền `db`.
 */
export async function enqueueEmail(tx: Prisma.TransactionClient, input: z.input<typeof enqueueSchema>) {
  const { to, departmentId, ...data } = enqueueSchema.parse(input)
  return tx.notificationDelivery.create({
    // nextAttemptAt gán từ code (UTC) để khớp phép so sánh trong claimDueDeliveries.
    data: { ...data, recipient: to, departmentId: departmentId ?? null, nextAttemptAt: new Date() },
    select: { id: true },
  })
}

export type OutgoingEmail = RenderedEmail & { to: string; messageId: string }

/** Lớp gửi SMTP; test truyền bản giả. `from` rỗng nghĩa là thiếu cấu hình SMTP_FROM. */
export type Mailer = {
  from: string
  send: (email: OutgoingEmail) => Promise<{ messageId?: string }>
}

export function createMailer(config: AppConfig): Mailer {
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } } : {}),
  })
  return {
    from: config.SMTP_FROM,
    send: async (email) => {
      try {
        return await transport.sendMail({ ...email, from: config.SMTP_FROM })
      } catch (error) {
        // Không để mật khẩu SMTP lọt vào lastError hay log.
        if (config.SMTP_PASSWORD && error instanceof Error) {
          error.message = error.message.replaceAll(config.SMTP_PASSWORD, '***')
        }
        throw error
      }
    },
  }
}

const BATCH_SIZE = 20
const MAX_ATTEMPTS = 5
/** Thời gian chờ (phút) sau lần thử thứ 1, 2, 3, 4 bị lỗi tạm thời; lần thứ 5 lỗi thì FAILED. */
const RETRY_DELAY_MINUTES = [1, 5, 15, 60]

type ClaimedDelivery = { id: string; type: string; recipient: string; refId: string; attempts: number }

/**
 * Nhận các email đến hạn (PENDING/RETRY, hoặc SENDING kẹt quá 10 phút) và chuyển SENDING trong một câu lệnh.
 * `FOR UPDATE SKIP LOCKED` để hai worker chạy cùng lúc không nhận trùng dòng.
 * Cột thời gian Prisma lưu giờ UTC không kèm múi giờ, nên so với `now() AT TIME ZONE 'UTC'`.
 */
function claimDueDeliveries() {
  return db.$queryRaw<ClaimedDelivery[]>`
    WITH due AS (
      SELECT id FROM notification_deliveries
      WHERE (status IN ('PENDING', 'RETRY') AND "nextAttemptAt" <= now() AT TIME ZONE 'UTC')
         OR (status = 'SENDING' AND "lockedAt" < now() AT TIME ZONE 'UTC' - interval '10 minutes')
      ORDER BY "nextAttemptAt"
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE notification_deliveries AS d
    SET status = 'SENDING',
        attempts = d.attempts + 1,
        "lockedAt" = now() AT TIME ZONE 'UTC',
        "updatedAt" = now() AT TIME ZONE 'UTC'
    FROM due
    WHERE d.id = due.id
    RETURNING d.id, d.type, d.recipient, d."refId", d.attempts`
}

/** Một lượt của worker email (`startJob('email', ...)`). Trả số email đã nhận xử lý. */
export async function processEmailQueue(mailer: Mailer, log: FastifyBaseLogger) {
  const deliveries = await claimDueDeliveries()
  for (const delivery of deliveries) await deliver(delivery, mailer, log)
  return deliveries.length
}

async function deliver(delivery: ClaimedDelivery, mailer: Mailer, log: FastifyBaseLogger) {
  const template = templateFor(delivery.type)
  if (!template) return fail(delivery, `Không có mẫu email "${delivery.type}"`, log)
  if (!mailer.from) return fail(delivery, 'Thiếu cấu hình SMTP_FROM', log)

  try {
    const email = await template(delivery.refId)
    if (!email) return await fail(delivery, 'Bản ghi gốc không còn', log)
    // Message-ID cố định theo id dòng: gửi lại sau khi kẹt vẫn là cùng một thư.
    const info = await mailer.send({ ...email, to: delivery.recipient, messageId: `<${delivery.id}@apc-portal>` })
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: 'SENT', messageId: cleanMessageId(info.messageId), lastError: null, lockedAt: null },
    })
  } catch (error) {
    const reason = describeError(error)
    if (isPermanentError(error) || delivery.attempts >= MAX_ATTEMPTS) return fail(delivery, reason, log)
    const delayMinutes = RETRY_DELAY_MINUTES[delivery.attempts - 1] ?? 60
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: 'RETRY', lastError: reason, lockedAt: null, nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000) },
    })
  }
}

/** Dừng hẳn, ghi log mức lỗi để vận hành biết; không đụng dữ liệu nghiệp vụ. */
async function fail(delivery: ClaimedDelivery, reason: string, log: FastifyBaseLogger) {
  await db.notificationDelivery.update({
    where: { id: delivery.id },
    data: { status: 'FAILED', lastError: reason, lockedAt: null },
  })
  log.error({ deliveryId: delivery.id, type: delivery.type, reason }, 'Email gửi lỗi, không thử lại')
}

/** SMTP trả mã 5xx là lỗi vĩnh viễn (sai địa chỉ, bị từ chối); còn lại coi là lỗi tạm thời. */
function isPermanentError(error: unknown) {
  const code = (error as { responseCode?: unknown } | null)?.responseCode
  return typeof code === 'number' && code >= 500 && code < 600
}

/** Dòng đầu của lỗi, bỏ địa chỉ email, tối đa 300 ký tự (lưu vào lastError và log). */
export function describeError(error: unknown) {
  const { code, responseCode, message, errors } = (error ?? {}) as {
    code?: unknown
    responseCode?: unknown
    message?: unknown
    errors?: { message?: unknown }[] // AggregateError khi thử cả IPv4 lẫn IPv6 đều lỗi: message ngoài cùng rỗng
  }
  const firstLine = String(message || errors?.[0]?.message || '').split('\n')[0] ?? ''
  return [code, responseCode, firstLine]
    .filter((part) => part !== undefined && part !== '')
    .join(' ')
    .replace(/[^\s<>@]+@[^\s<>@]+/g, '[email]')
    .slice(0, 300)
}

const cleanMessageId = (value: string | undefined) => value?.replace(/[<>\s]/g, '').slice(0, 200) || null

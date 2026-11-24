import type { FastifyBaseLogger, FastifyRequest } from 'fastify'
import nodemailer from 'nodemailer'
import { z } from 'zod'

import type { AppConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { Prisma } from '../../db/generated/client.js'
import { conflict, notFound } from '../../lib/errors.js'
import { pageArgs, pageQuery, toPage } from '../../lib/pagination.js'
import { incidentIdSchema, reasonSchema } from '../accounts/service.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult } from '../audit/service.js'
import { type AuthUser, departmentScope, hasRole } from '../auth/rbac.js'
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
    await db.notificationDelivery.updateMany({
      where: { id: delivery.id },
      data: { status: 'SENT', messageId: cleanMessageId(info.messageId), lastError: null, lockedAt: null },
    })
  } catch (error) {
    const reason = describeError(error)
    if (isPermanentError(error) || delivery.attempts >= MAX_ATTEMPTS) return fail(delivery, reason, log)
    const delayMinutes = RETRY_DELAY_MINUTES[delivery.attempts - 1] ?? 60
    await db.notificationDelivery.updateMany({
      where: { id: delivery.id },
      data: { status: 'RETRY', lastError: reason, lockedAt: null, nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000) },
    })
  }
}

/** Dừng hẳn, ghi log mức lỗi để vận hành biết; không đụng dữ liệu nghiệp vụ. */
async function fail(delivery: ClaimedDelivery, reason: string, log: FastifyBaseLogger) {
  // updateMany: dòng đã bị xóa giữa lúc gửi (dọn dữ liệu test) thì bỏ qua, không làm vỡ cả lượt worker.
  await db.notificationDelivery.updateMany({
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

// ─── TRANG THEO DÕI EMAIL (O3) ─────────────────────────────────────────────

const filterSchema = pageQuery.extend({
  status: z.enum(['PENDING', 'SENDING', 'RETRY', 'SENT', 'FAILED']).optional(),
  type: z.enum(EMAIL_TYPES).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
})
type Filter = z.infer<typeof filterSchema>
const incidentSchema = z.object({ incidentId: incidentIdSchema, reason: reasonSchema })
const idParams = z.object({ id: z.string().min(1).max(64) })

const deliverySelect = {
  id: true, type: true, recipient: true, status: true, attempts: true, nextAttemptAt: true,
  lastError: true, createdAt: true, updatedAt: true, department: { select: { id: true, name: true } },
} satisfies Prisma.NotificationDeliverySelect

type DeliveryRow = Prisma.NotificationDeliveryGetPayload<{ select: typeof deliverySelect }>

/** TECH_ADMIN chỉ thấy metadata: bỏ người nhận (Vai trò & quyền §8.7). refType/refId không bao giờ trả ra. */
function toView({ recipient, ...rest }: DeliveryRow, withRecipient: boolean) {
  return withRecipient ? { ...rest, recipient } : rest
}

const filterWhere = (q: Filter): Prisma.NotificationDeliveryWhereInput => ({
  ...(q.status ? { status: q.status } : {}),
  ...(q.type ? { type: q.type } : {}),
  ...(q.from || q.to
    ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
    : {}),
})

async function listPage(where: Prisma.NotificationDeliveryWhereInput, query: Filter, withRecipient: boolean) {
  const [items, total] = await db.$transaction([
    db.notificationDelivery.findMany({ where, select: deliverySelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...pageArgs(query) }),
    db.notificationDelivery.count({ where }),
  ])
  return toPage(items.map((item) => toView(item, withRecipient)), total, query)
}

/** DEPARTMENT_MANAGER: ban mình; BOARD: tất cả. Lọc phạm vi ngay trong truy vấn. */
export function listDeliveries(user: AuthUser, rawQuery: unknown) {
  const query = filterSchema.parse(rawQuery)
  return listPage({ ...filterWhere(query), ...departmentScope(user) }, query, true)
}

/** Phạm vi đã được `requireScope` kiểm ở route. */
export async function getDelivery(rawParams: unknown) {
  const { id } = idParams.parse(rawParams)
  const row = await db.notificationDelivery.findUnique({ where: { id }, select: deliverySelect })
  if (!row) throw notFound()
  return toView(row, true)
}

/** TECH_ADMIN theo quyền INCIDENT: mã sự cố + lý do (422 nếu thiếu), ghi audit SECURITY, không trả người nhận. */
export async function searchDeliveriesAsIncident(request: FastifyRequest, rawBody: unknown) {
  const { incidentId, reason, ...rest } = incidentSchema.extend(filterSchema.shape).parse(rawBody ?? {})
  const query = filterSchema.parse(rest)
  const result = await listPage(filterWhere(query), query, false)
  await audit(request, {
    action: AUDIT_ACTIONS.SYSTEM_INCIDENT_ACCESS, targetType: 'EMAIL_DELIVERY',
    category: AuditCategory.SECURITY, result: AuditResult.SUCCESS, incidentId, reason,
    metadata: { status: query.status, type: query.type, total: result.total },
  })
  return result
}

export async function getDeliveryAsIncident(request: FastifyRequest, rawParams: unknown, rawBody: unknown) {
  const { id } = idParams.parse(rawParams)
  const { incidentId, reason } = incidentSchema.parse(rawBody ?? {})
  const row = await db.notificationDelivery.findUnique({ where: { id }, select: deliverySelect })
  if (!row) throw notFound()
  await audit(request, {
    action: AUDIT_ACTIONS.SYSTEM_INCIDENT_ACCESS, targetType: 'EMAIL_DELIVERY', targetId: id,
    category: AuditCategory.SECURITY, result: AuditResult.SUCCESS, incidentId, reason,
  })
  return toView(row, false)
}

/**
 * Gửi lại: chỉ FAILED → PENDING, đặt lại số lần thử. BOARD gửi được (lý do/mã sự cố tùy chọn);
 * TECH_ADMIN bắt buộc mã sự cố + lý do. Quyền vai trò đã chặn ở route (DEPARTMENT_MANAGER: 403).
 */
export async function retryDelivery(request: FastifyRequest, user: AuthUser, rawParams: unknown, rawBody: unknown) {
  const { id } = idParams.parse(rawParams)
  const isBoard = hasRole(user, 'BOARD')
  // Form gửi chuỗi rỗng khi BOARD bỏ trống ô không bắt buộc: coi như không nhập.
  const blankAsMissing = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value)
  const body = z
    .object({
      reason: z.preprocess(blankAsMissing, isBoard ? reasonSchema.optional() : reasonSchema),
      incidentId: z.preprocess(blankAsMissing, isBoard ? incidentIdSchema.optional() : incidentIdSchema),
    })
    .parse(rawBody ?? {})
  return db.$transaction(async (tx) => {
    const row = await tx.notificationDelivery.findUnique({ where: { id }, select: { type: true, attempts: true } })
    if (!row) throw notFound()
    // Điều kiện trạng thái nằm trong câu UPDATE: hai người bấm cùng lúc thì chỉ một người thành công.
    const { count } = await tx.notificationDelivery.updateMany({
      where: { id, status: 'FAILED' },
      data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), lockedAt: null, lastError: null },
    })
    if (count === 0) throw conflict('Chỉ gửi lại được email ở trạng thái Gửi lỗi.')
    await audit(request, {
      action: AUDIT_ACTIONS.EMAIL_RESEND, targetType: 'EMAIL_DELIVERY', targetId: id,
      category: isBoard ? AuditCategory.BUSINESS : AuditCategory.SECURITY, result: AuditResult.SUCCESS,
      reason: body.reason ?? null, incidentId: body.incidentId ?? null,
      metadata: { type: row.type, previousAttempts: row.attempts },
    }, tx)
    return { id, status: 'PENDING' as const }
  })
}

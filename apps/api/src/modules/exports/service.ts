import { randomUUID } from 'node:crypto'

import type { FastifyRequest } from 'fastify'
import { stringify } from 'csv-stringify/sync'
import { z } from 'zod'

import { db } from '../../db/client.js'
import type { ExportFileStatus } from '../../db/generated/client.js'
import { notFound } from '../../lib/errors.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult } from '../audit/service.js'
import { currentUser, requireAuth, requireRole } from '../auth/rbac.js'
import { contentDisposition } from '../files/service.js'
import type { FileStorage } from '../files/storage.js'

export const EXPORT_TTL_MS = 24 * 60 * 60 * 1000
export const EXPORT_CLEANUP_BATCH_SIZE = 100

const EXPORT_KINDS = ['recruitment', 'event', 'member', 'data_request'] as const
const exportRequestSchema = z.object({
  kind: z.enum(EXPORT_KINDS),
  filename: z.string().trim().min(1).max(200),
  rows: z.array(z.record(z.string(), z.unknown())),
  downloaderId: z.string().min(1).max(64).optional(),
})

const EXPORT_AUDIT_ACTIONS = {
  recruitment: AUDIT_ACTIONS.RECRUITMENT_EXPORT,
  event: AUDIT_ACTIONS.EVENT_EXPORT,
  member: AUDIT_ACTIONS.MEMBER_EXPORT,
  data_request: AUDIT_ACTIONS.DATA_REQUEST_EXPORT,
} as const

export type ExportsContext = { storage: FileStorage }
export type CreateExportInput = z.input<typeof exportRequestSchema>

function cleanFilename(value: string) {
  const basename = value.split(/[\\/]/).pop() ?? ''
  // eslint-disable-next-line no-control-regex
  const safe = basename.replace(/[\u0000-\u001f\u007f";]/g, '').trim().slice(0, 180)
  return safe.toLowerCase().endsWith('.csv') ? safe : `${safe || 'du-lieu'}.csv`
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value) ?? String(value)
}

/** Thêm dấu nháy đơn cho ô CSV có thể bị Excel hiểu là công thức (FLOW-25, SEC-09). */
export function neutralizeCsvFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export function createCsv(rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const columns = keys.map((key) => ({ key, header: neutralizeCsvFormula(key) }))
  const normalizedRows = rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, neutralizeCsvFormula(toCsvValue(value))])),
  )
  // Khi không có dòng, file vẫn có BOM và không chứa nội dung dữ liệu.
  const csv = normalizedRows.length
    ? stringify(normalizedRows, { header: true, columns, record_delimiter: 'windows' })
    : ''
  return Buffer.from(`\uFEFF${csv}`, 'utf8')
}

/**
 * Tạo file CSV và lưu vào kho riêng. Endpoint nghiệp vụ gọi hàm này sau khi `requireRole`/`requireScope`
 * đã xác nhận quyền và đã truy vấn rows trong phạm vi của request.
 */
export async function createExport(
  request: FastifyRequest,
  rawInput: CreateExportInput,
  context: ExportsContext,
) {
  // Recheck authentication and export role at creation; scoped callers must also use requireScope on their parent record.
  await requireAuth(request)
  const input = exportRequestSchema.parse(rawInput)
  const roleGuard = input.kind === 'member' || input.kind === 'data_request'
    ? requireRole('BOARD')
    : requireRole('DEPARTMENT_MANAGER', 'BOARD')
  await roleGuard(request)
  const user = currentUser(request)
  if (input.downloaderId && input.downloaderId !== user.id && input.kind !== 'data_request') {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['downloaderId'],
        message: 'Chỉ yêu cầu dữ liệu cá nhân mới được chỉ định người tải khác.',
        input: undefined,
      },
    ])
  }

  const filename = cleanFilename(input.filename)
  const storageKey = `exports/${randomUUID()}.csv`
  const now = new Date()
  const expiresAt = new Date(now.getTime() + EXPORT_TTL_MS)
  const exportFile = await db.exportFile.create({
    data: {
      createdById: user.id,
      downloaderId: input.downloaderId ?? user.id,
      kind: input.kind,
      filename,
      storageKey,
      status: 'CREATING',
      expiresAt,
    },
  })

  try {
    const csv = createCsv(input.rows)
    await context.storage.put(storageKey, csv, 'text/csv; charset=utf-8')
    const ready = await db.$transaction(async (tx) => {
      const updated = await tx.exportFile.update({
        where: { id: exportFile.id },
        data: { status: 'READY' },
        select: { id: true, status: true, filename: true, expiresAt: true },
      })
      await audit(
        request,
        {
          action: EXPORT_AUDIT_ACTIONS[input.kind],
          targetType: 'EXPORT_FILE',
          targetId: exportFile.id,
          category: AuditCategory.BUSINESS,
          result: AuditResult.SUCCESS,
          metadata: { kind: input.kind, rowCount: input.rows.length, downloaderId: input.downloaderId ?? user.id },
        },
        tx,
      )
      return updated
    })
    return ready
  } catch (error) {
    await context.storage.delete(storageKey).catch(() => undefined)
    await db.exportFile.update({
      where: { id: exportFile.id },
      data: { status: 'EXPIRED', expiresAt: new Date() },
    })
    await audit(request, {
      action: EXPORT_AUDIT_ACTIONS[input.kind],
      targetType: 'EXPORT_FILE',
      targetId: exportFile.id,
      category: AuditCategory.BUSINESS,
      result: AuditResult.FAILURE,
      reason: 'Không tạo được tệp xuất',
      metadata: { kind: input.kind, rowCount: input.rows.length },
    })
    throw error
  }
}

/** Chỉ người được chỉ định tải được file READY còn hạn; mọi trường hợp khác đều 404. */
export async function downloadExport(
  context: ExportsContext,
  request: FastifyRequest,
  reply: import('fastify').FastifyReply,
  id: string,
  now = new Date(),
) {
  const user = request.user
  const exportFile = user
    ? await db.exportFile.findFirst({
        where: { id, downloaderId: user.id, status: 'READY', expiresAt: { gt: now } },
        select: { storageKey: true, filename: true },
      })
    : null
  if (!exportFile) throw notFound()

  const body = await context.storage.get(exportFile.storageKey)
  return reply
    .type('text/csv; charset=utf-8')
    .header('X-Content-Type-Options', 'nosniff')
    .header('Content-Security-Policy', "default-src 'none'; sandbox")
    .header('Cache-Control', 'private, no-store')
    .header('Content-Disposition', contentDisposition('attachment', exportFile.filename))
    .send(body)
}

/** Xóa vật lý các object hết hạn rồi giữ lại bản ghi EXPIRED để truy vết trạng thái. */
export async function cleanupExpiredExports(
  context: ExportsContext,
  now = new Date(),
  batchSize = EXPORT_CLEANUP_BATCH_SIZE,
) {
  const expired = await db.exportFile.findMany({
    where: { status: { in: ['READY', 'CREATING'] satisfies ExportFileStatus[] }, expiresAt: { lte: now } },
    orderBy: { expiresAt: 'asc' },
    take: batchSize,
    select: { id: true, storageKey: true, kind: true },
  })

  for (const file of expired) {
    await context.storage.delete(file.storageKey)
    await db.$transaction(async (tx) => {
      const changed = await tx.exportFile.updateMany({
        where: { id: file.id, status: { in: ['READY', 'CREATING'] }, expiresAt: { lte: now } },
        data: { status: 'EXPIRED' },
      })
      if (changed.count > 0) {
        await audit(
          { service: 'export-cleanup' },
          {
            action: AUDIT_ACTIONS.EXPORT_EXPIRE,
            targetType: 'EXPORT_FILE',
            targetId: file.id,
            category: AuditCategory.OPERATIONS,
            result: AuditResult.SUCCESS,
            metadata: { kind: file.kind },
          },
          tx,
        )
      }
    })
  }

  return { expired: expired.length }
}

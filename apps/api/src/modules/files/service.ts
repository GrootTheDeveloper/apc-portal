import { randomUUID } from 'node:crypto'

import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify'
import { fileTypeFromBuffer } from 'file-type'
import { z } from 'zod'

import { db } from '../../db/client.js'
import type { FilePurpose, FileScanStatus, FileVisibility, Prisma } from '../../db/generated/client.js'
import { AppError, notFound } from '../../lib/errors.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult, type AuditRequestLike } from '../audit/service.js'
import { type AuthUser, currentUser, hasRole } from '../auth/rbac.js'
import { type FileScanner, ScanUnavailableError } from './scan.js'
import { type FileStorage, readAll } from './storage.js'

// Upload tệp dùng chung (D2). Cách dùng cho các mảng khác:
//   1. Web dùng <FileUpload purpose="CONTENT_IMAGE" onUploaded={({ id }) => ...} /> (apps/web/src/components).
//   2. Lưu `id` vào bản ghi nghiệp vụ (vd Post.thumbnailUrl = `/api/public/files/${id}`).
//   3. Tệp chỉ tải được khi đã CLEAN: PUBLIC qua GET /public/files/:id, ảnh đại diện qua GET /portal/files/:id,
//      tài liệu (DOCUMENT) chỉ qua thư viện tài liệu D4.

/** Tối đa 20 MB (DOC-06). */
export const MAX_FILE_SIZE = 20 * 1024 * 1024

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
// PDF, DOCX, XLSX, PPTX (DOC-05). Không nhận tệp thực thi, SVG/HTML (chạy được script) hay định dạng khác.
const DOCUMENT_TYPES = [
  ...IMAGE_TYPES,
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]
const ALLOWED_TYPES: Record<FilePurpose, readonly string[]> = {
  CONTENT_IMAGE: IMAGE_TYPES,
  AVATAR: IMAGE_TYPES,
  DOCUMENT: DOCUMENT_TYPES,
}

export const uploadPurposeSchema = z.enum(['CONTENT_IMAGE', 'AVATAR', 'DOCUMENT'])
export const fileParamsSchema = z.object({ id: z.string().min(1).max(64) })

export type FilesContext = { storage: FileStorage; scanner: FileScanner }

/** 422 cho tệp không hợp lệ (sai loại, quá lớn, có mã độc). */
export const invalidFile = (message: string) => new AppError(422, 'validation', message)

/**
 * Server quyết định phạm vi, không nhận từ client. Chỉ ảnh nội dung do DEPARTMENT_MANAGER/BOARD tải lên mới PUBLIC;
 * AVATAR luôn INTERNAL (MEM-10), DOCUMENT luôn INTERNAL.
 */
export function decideVisibility(user: AuthUser, purpose: FilePurpose): FileVisibility {
  const canPublish = hasRole(user, 'DEPARTMENT_MANAGER') || hasRole(user, 'BOARD')
  return purpose === 'CONTENT_IMAGE' && canPublish ? 'PUBLIC' : 'INTERNAL'
}

/** Loại tệp xác định bằng nội dung (magic bytes), không tin đuôi file hay header Content-Type. */
export async function detectMimeType(content: Buffer, purpose: FilePurpose): Promise<string> {
  const detected = await fileTypeFromBuffer(content)
  if (!detected || !ALLOWED_TYPES[purpose].includes(detected.mime)) {
    throw invalidFile(
      purpose === 'DOCUMENT'
        ? 'Chỉ nhận ảnh JPG, PNG, WebP, GIF, tệp PDF, DOCX, XLSX hoặc PPTX.'
        : 'Chỉ nhận ảnh JPG, PNG, WebP hoặc GIF.',
    )
  }
  return detected.mime
}

/** Bỏ đường dẫn và ký tự điều khiển khỏi tên gốc; chỉ dùng để hiển thị và đặt tên khi tải về. */
export function cleanFileName(name: string | undefined) {
  const base = (name ?? '').split(/[/\\]/).pop() ?? ''
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, '').trim().slice(0, 200)
  return cleaned || 'tep'
}

export async function uploadFile(
  context: FilesContext,
  request: FastifyRequest,
  input: { purpose: FilePurpose; originalName: string | undefined; content: Buffer },
) {
  const user = currentUser(request)
  if (input.content.length === 0) throw invalidFile('Tệp rỗng.')
  if (input.content.length > MAX_FILE_SIZE) throw invalidFile('Tệp vượt quá 20 MB.')
  const mimeType = await detectMimeType(input.content, input.purpose)

  // Khóa ngẫu nhiên, không chứa tên gốc hay thông tin người tải lên.
  const storageKey = `files/${randomUUID()}`
  await context.storage.put(storageKey, input.content, mimeType)
  const file = await db.storedFile.create({
    data: {
      storageKey,
      originalName: cleanFileName(input.originalName),
      mimeType,
      size: input.content.length,
      purpose: input.purpose,
      visibility: decideVisibility(user, input.purpose),
      scanStatus: 'PENDING',
      uploadedById: user.id,
    },
  })

  const scanStatus = await applyScan(context, request, request.log, file, input.content)
  if (scanStatus === 'REJECTED') throw invalidFile('Tệp có dấu hiệu chứa mã độc nên đã bị từ chối.')
  // Chỉ trả id và trạng thái; không trả khóa hay URL kho.
  return { id: file.id, scanStatus }
}

type ScannableFile = { id: string; storageKey: string; purpose: FilePurpose; mimeType: string; size: number }

/**
 * Quét một tệp đang PENDING và chuyển trạng thái. clamd không phản hồi thì giữ PENDING (vùng cách ly)
 * để tác vụ `file-scan` quét lại. Phát hiện mã độc: REJECTED, xóa khỏi kho, ghi audit SECURITY.
 */
async function applyScan(
  context: FilesContext,
  actor: AuditRequestLike,
  log: FastifyBaseLogger,
  file: ScannableFile,
  content: Buffer,
): Promise<FileScanStatus> {
  let result
  try {
    result = await context.scanner.scan(content)
  } catch (error) {
    if (!(error instanceof ScanUnavailableError)) throw error
    log.warn({ fileId: file.id, err: error.message }, 'Chưa quét được tệp, giữ PENDING')
    return 'PENDING'
  }

  const scannedAt = new Date()
  if (result.status === 'clean') {
    if (context.scanner.mode === 'skip') {
      log.warn({ fileId: file.id }, 'FILE_SCAN_MODE=skip: tệp được đánh dấu CLEAN mà không quét mã độc')
    }
    await db.storedFile.updateMany({
      where: { id: file.id, scanStatus: 'PENDING' },
      data: { scanStatus: 'CLEAN', scannedAt },
    })
    return 'CLEAN'
  }

  // Đánh dấu REJECTED trước để tệp không bao giờ tải được, rồi mới xóa khỏi kho.
  await db.storedFile.updateMany({
    where: { id: file.id, scanStatus: 'PENDING' },
    data: { scanStatus: 'REJECTED', scannedAt },
  })
  await context.storage.delete(file.storageKey)
  await audit(actor, {
    action: AUDIT_ACTIONS.FILE_MALWARE_DETECTED,
    targetType: 'FILE',
    targetId: file.id,
    category: AuditCategory.SECURITY,
    result: AuditResult.FAILURE,
    reason: 'Phát hiện mã độc khi quét tệp tải lên',
    metadata: { signature: result.signature, purpose: file.purpose, mimeType: file.mimeType, size: file.size },
  })
  log.warn({ fileId: file.id, signature: result.signature }, 'Tệp tải lên chứa mã độc, đã từ chối')
  return 'REJECTED'
}

/**
 * Tác vụ `file-scan` (O1, mỗi phút): quét lại tệp còn PENDING do lúc upload clamd không phản hồi.
 * Bỏ qua tệp mới tạo dưới `olderThanMs` để không quét trùng với request upload đang chạy.
 */
export async function rescanPendingFiles(
  context: FilesContext,
  log: FastifyBaseLogger,
  { olderThanMs = 60_000, batchSize = 20 } = {},
) {
  const files = await db.storedFile.findMany({
    where: { scanStatus: 'PENDING', createdAt: { lt: new Date(Date.now() - olderThanMs) } },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
    select: { id: true, storageKey: true, purpose: true, mimeType: true, size: true },
  })

  let scanned = 0
  for (const file of files) {
    let content: Buffer
    try {
      content = await readAll(await context.storage.get(file.storageKey))
    } catch (error) {
      log.error({ err: error, fileId: file.id }, 'Không đọc được tệp PENDING từ kho')
      continue
    }
    const status = await applyScan(context, { service: 'file-scan' }, log, file, content)
    // clamd vẫn chưa sẵn sàng: dừng lượt này, phút sau thử lại.
    if (status === 'PENDING') break
    scanned += 1
  }
  return { scanned }
}

/**
 * Trả nội dung tệp đã CLEAN khớp điều kiện, ngược lại 404 (không phân biệt không tồn tại / chưa quét / sai phạm vi).
 */
export async function sendStoredFile(
  context: FilesContext,
  reply: FastifyReply,
  where: Prisma.StoredFileWhereInput & { id: string },
  cacheControl: string,
) {
  const file = await db.storedFile.findFirst({
    where: { ...where, scanStatus: 'CLEAN' },
    select: { storageKey: true, mimeType: true, originalName: true },
  })
  if (!file) throw notFound()

  const body = await context.storage.get(file.storageKey)
  const isImage = IMAGE_TYPES.includes(file.mimeType)
  reply
    .header('Content-Type', file.mimeType)
    .header('X-Content-Type-Options', 'nosniff')
    .header('Content-Security-Policy', "default-src 'none'; sandbox")
    .header('Cache-Control', cacheControl)
    .header('Content-Disposition', contentDisposition(isImage ? 'inline' : 'attachment', file.originalName))
  return reply.send(body)
}

/** Header Content-Disposition có tên tiếng Việt (RFC 6266): `filename` ASCII dự phòng + `filename*` UTF-8. */
export function contentDisposition(type: 'inline' | 'attachment', name: string) {
  const ascii = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

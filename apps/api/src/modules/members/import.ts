import { createHash } from 'node:crypto'

import { parse } from 'csv-parse/sync'
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'

import { db } from '../../db/client.js'
import { conflict } from '../../lib/errors.js'
import { createAccount } from '../accounts/service.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult } from '../audit/service.js'
import { currentUser, requireRole } from '../auth/rbac.js'
import { createExport, type ExportsContext } from '../exports/service.js'

export const MEMBER_CSV_MAX_SIZE = 2 * 1024 * 1024
export const MEMBER_CSV_MAX_ROWS = 500
export const MEMBER_CSV_COLUMNS = [
  'fullName', 'username', 'email', 'studentId', 'faculty', 'major', 'cohort', 'departmentCode',
] as const

const rowSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự.').max(120, 'Họ tên tối đa 120 ký tự.'),
  username: z.string().trim().toLowerCase().min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự.').max(50, 'Tên đăng nhập tối đa 50 ký tự.').regex(/^[a-z0-9._-]+$/, 'Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, gạch ngang.'),
  email: z.email('Email không hợp lệ.').trim().toLowerCase().max(200),
  studentId: z.string().trim().min(4, 'MSSV phải có ít nhất 4 ký tự.').max(20, 'MSSV tối đa 20 ký tự.').regex(/^[A-Za-z0-9-]+$/, 'MSSV chỉ gồm chữ cái, chữ số và gạch ngang.').toUpperCase(),
  faculty: z.string().trim().max(120, 'Khoa tối đa 120 ký tự.'),
  major: z.string().trim().max(120, 'Ngành tối đa 120 ký tự.'),
  cohort: z.string().trim().max(40, 'Khóa tối đa 40 ký tự.'),
  departmentCode: z.string().trim().toLowerCase().min(1, 'Mã ban là bắt buộc.').max(50, 'Mã ban tối đa 50 ký tự.'),
})

export type MemberImportError = { row: number; column: string; message: string }
type CsvMember = z.infer<typeof rowSchema>

export function memberCsvTemplate() {
  const header = MEMBER_CSV_COLUMNS.join(',')
  const example = ['Nguyễn Văn A', 'nguyenvana', 'nguyenvana@example.com', '23123456', 'Khoa giả lập', 'Ngành mẫu', 'K29', 'ban-a']
  return Buffer.from(`\uFEFF${header}\r\n${example.map(csvEscape).join(',')}\r\n`, 'utf8')
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function parseCsv(content: Buffer) {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(content)
  } catch {
    throw new z.ZodError([{ code: 'custom', path: ['file'], message: 'Tệp phải được mã hóa UTF-8.', input: undefined }])
  }

  let records: string[][]
  try {
    records = parse(text, { bom: true, skip_empty_lines: true, relax_column_count: false, max_record_size: 20_000 }) as string[][]
  } catch {
    throw new z.ZodError([{ code: 'custom', path: ['file'], message: 'CSV sai cấu trúc hoặc có một dòng vượt giới hạn.', input: undefined }])
  }
  if (records.length === 0) throw new z.ZodError([{ code: 'custom', path: ['file'], message: 'Tệp CSV đang trống.', input: undefined }])
  if (records.length - 1 > MEMBER_CSV_MAX_ROWS) {
    throw new z.ZodError([{ code: 'custom', path: ['file'], message: `Tệp vượt quá ${MEMBER_CSV_MAX_ROWS} dòng dữ liệu.`, input: undefined }])
  }
  const header = records[0]!.map((column) => column.trim())
  if (header.length !== MEMBER_CSV_COLUMNS.length || MEMBER_CSV_COLUMNS.some((column, index) => header[index] !== column)) {
    throw new z.ZodError([{ code: 'custom', path: ['file'], message: `Header phải đúng thứ tự: ${MEMBER_CSV_COLUMNS.join(', ')}.`, input: undefined }])
  }
  return records.slice(1).map((record) => Object.fromEntries(MEMBER_CSV_COLUMNS.map((column, index) => [column, record[index]?.trim() ?? ''])))
}

function fieldMessage(error: z.ZodError, field: string) {
  return error.issues.find((issue) => issue.path[0] === field)?.message
}

async function validateRows(content: Buffer) {
  const rows = parseCsv(content)
  if (rows.length === 0) throw new z.ZodError([{ code: 'custom', path: ['file'], message: 'Tệp không có dòng dữ liệu.', input: undefined }])

  const errors: MemberImportError[] = []
  const parsedRows: (CsvMember | null)[] = []
  const seen = { username: new Set<string>(), email: new Set<string>(), studentId: new Set<string>() }
  rows.forEach((raw, index) => {
    const line = index + 2
    const result = rowSchema.safeParse(raw)
    if (!result.success) {
      for (const field of MEMBER_CSV_COLUMNS) {
        const message = fieldMessage(result.error, field)
        if (message) errors.push({ row: line, column: field, message })
      }
      parsedRows.push(null)
      return
    }
    const row = result.data
    parsedRows.push(row)
    for (const field of ['username', 'email', 'studentId'] as const) {
      const normalized = row[field].toLowerCase()
      if (seen[field].has(normalized)) errors.push({ row: line, column: field, message: `Giá trị ${field} bị trùng trong tệp.` })
      seen[field].add(normalized)
    }
  })

  const valid = parsedRows.filter((row): row is CsvMember => row !== null)
  const [departments, existingUsers] = await Promise.all([
    db.department.findMany({ where: { code: { in: [...new Set(valid.map((row) => row.departmentCode))] } }, select: { id: true, code: true, status: true } }),
    db.user.findMany({
      where: { OR: [
        { username: { in: [...seen.username] } },
        { email: { in: [...seen.email] } },
        { studentId: { in: [...seen.studentId], mode: 'insensitive' } },
      ] },
      select: { username: true, email: true, studentId: true },
    }),
  ])
  const departmentByCode = new Map(departments.map((department) => [department.code.toLowerCase(), department]))
  rows.forEach((raw, index) => {
    const row = parsedRows[index]
    if (!row) return
    const line = index + 2
    const department = departmentByCode.get(row.departmentCode.toLowerCase())
    if (!department) errors.push({ row: line, column: 'departmentCode', message: 'Mã ban không tồn tại.' })
    else if (department.status !== 'ACTIVE') errors.push({ row: line, column: 'departmentCode', message: 'Ban đã lưu trữ, không thể gán thành viên mới.' })
    if (existingUsers.some((user) => user.username === row.username)) errors.push({ row: line, column: 'username', message: 'Tên đăng nhập đã tồn tại.' })
    if (existingUsers.some((user) => user.email === row.email)) errors.push({ row: line, column: 'email', message: 'Email đã tồn tại.' })
    if (existingUsers.some((user) => user.studentId?.toLowerCase() === row.studentId.toLowerCase())) errors.push({ row: line, column: 'studentId', message: 'MSSV đã tồn tại.' })
  })
  const invalidRows = new Set(errors.map((error) => error.row)).size
  return { rows: parsedRows, departments: departmentByCode, errors, invalidRows }
}

export async function inspectMemberImport(request: FastifyRequest, content: Buffer) {
  await requireRole('BOARD')(request)
  if (content.length > MEMBER_CSV_MAX_SIZE) throw new z.ZodError([{ code: 'custom', path: ['file'], message: 'Tệp CSV tối đa 2 MB.', input: undefined }])
  const validation = await validateRows(content)
  const fileHash = createHash('sha256').update(content).digest('hex')
  const batchId = createHash('sha256').update(`${currentUser(request).id}:${fileHash}`).digest('hex')
  return { batchId, fileHash, validRows: validation.rows.length - validation.invalidRows, totalRows: validation.rows.length, errors: validation.errors }
}

export async function importMembers(request: FastifyRequest, content: Buffer, batchId: string) {
  await requireRole('BOARD')(request)
  if (content.length > MEMBER_CSV_MAX_SIZE) throw new z.ZodError([{ code: 'custom', path: ['file'], message: 'Tệp CSV tối đa 2 MB.', input: undefined }])
  const fileHash = createHash('sha256').update(content).digest('hex')
  const actor = currentUser(request)
  const expectedBatchId = createHash('sha256').update(`${actor.id}:${fileHash}`).digest('hex')
  if (batchId !== expectedBatchId) throw new z.ZodError([{ code: 'custom', path: ['batchId'], message: 'Mã lô không khớp với tệp đã kiểm tra.', input: undefined }])

  const prior = await db.auditLog.findFirst({ where: { action: AUDIT_ACTIONS.MEMBER_IMPORT, targetType: 'MEMBER_IMPORT_BATCH', targetId: batchId }, select: { id: true } })
  if (prior) return { batchId, importedRows: 0, alreadyImported: true }

  const validation = await validateRows(content)
  if (validation.errors.length > 0) throw new z.ZodError([{ code: 'custom', path: ['file'], message: 'Tệp còn lỗi. Hãy kiểm tra lại trước khi nhập.', input: undefined }])

  const departments = validation.departments
  const alreadyImported = await db.$transaction(async (tx) => {
      const consumed = await tx.auditLog.findFirst({ where: { action: AUDIT_ACTIONS.MEMBER_IMPORT, targetType: 'MEMBER_IMPORT_BATCH', targetId: batchId }, select: { id: true } })
      if (consumed) return true
      for (const item of validation.rows) {
        if (!item) throw conflict('Tệp có dòng không hợp lệ; không có thành viên nào được nhập.')
        const department = departments.get(item.departmentCode.toLowerCase())
        if (!department || department.status !== 'ACTIVE') throw conflict('Ban đã thay đổi hoặc không còn hoạt động. Hãy kiểm tra lại tệp.')
        const { user } = await createAccount(tx, request, {
          username: item.username,
          email: item.email,
          fullName: item.fullName,
          departmentId: department.id,
        })
        await tx.user.update({
          where: { id: user.id },
          data: { studentId: item.studentId, faculty: item.faculty || null, major: item.major || null, cohort: item.cohort || null },
        })
      }
      await audit(request, {
        action: AUDIT_ACTIONS.MEMBER_IMPORT,
        targetType: 'MEMBER_IMPORT_BATCH',
        targetId: batchId,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        metadata: { batchId, fileHash, rowCount: validation.rows.length },
      }, tx)
      return false
  })
  return { batchId, importedRows: validation.rows.length, alreadyImported }
}

export async function exportMembers(request: FastifyRequest, context: ExportsContext) {
  await requireRole('BOARD')(request)
  const users = await db.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { fullName: true, username: true, email: true, studentId: true, faculty: true, major: true, cohort: true, department: { select: { code: true } } },
  })
  const rows = users.map((user) => ({
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    studentId: user.studentId ?? '',
    faculty: user.faculty ?? '',
    major: user.major ?? '',
    cohort: user.cohort ?? '',
    departmentCode: user.department?.code ?? '',
  }))
  return createExport(request, { kind: 'member', filename: `danh-sach-thanh-vien-${new Date().toISOString().slice(0, 10)}.csv`, rows }, context)
}

export const memberImportBatchSchema = z.string().trim().min(1).max(64)

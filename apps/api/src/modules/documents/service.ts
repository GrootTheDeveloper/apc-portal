import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { db } from '../../db/client.js'
import type { Document as DocumentRecord, Prisma, Role } from '../../db/generated/client.js'
import { conflict, forbidden, notFound } from '../../lib/errors.js'
import { pageArgs, pageQuery, toPage } from '../../lib/pagination.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult } from '../audit/service.js'
import { type AuthUser, canAccessDepartment, currentUser, departmentScope, hasRole } from '../auth/rbac.js'
import { incidentIdSchema, reasonSchema } from '../accounts/service.js'
import { sendStoredFile, type FilesContext } from '../files/service.js'

const documentParams = z.object({ id: z.string().min(1).max(64) })
const versionParams = documentParams.extend({ versionId: z.string().min(1).max(64) })
const documentBase = z.object({
  title: z.string().trim().min(1, 'Nhập tên tài liệu.').max(160),
  description: z.string().trim().max(2000).nullish(),
  category: z.string().trim().min(1, 'Chọn chuyên mục.').max(80),
  departmentId: z.string().trim().min(1).nullish(),
  scope: z.enum(['DEPARTMENT', 'CLUB']),
  allowedRoles: z.array(z.enum(['MEMBER', 'DEPARTMENT_MANAGER', 'BOARD'])).max(3).default([]),
})
const createSchema = documentBase.extend({ storedFileId: z.string().min(1).max(64), reason: reasonSchema })
const updateSchema = documentBase.extend({ updatedAt: z.iso.datetime(), reason: reasonSchema })
const fileActionSchema = z.object({ storedFileId: z.string().min(1).max(64), reason: reasonSchema, updatedAt: z.iso.datetime() })
const stateActionSchema = z.object({ reason: reasonSchema, updatedAt: z.iso.datetime() })
const listQuerySchema = pageQuery.extend({ status: z.enum(['ACTIVE', 'ARCHIVED', 'ALL']).default('ALL') })
const metadataSchema = z.object({ incidentId: incidentIdSchema, reason: reasonSchema })

type AdminActor = FastifyRequest & { user: AuthUser }
type DocWithVersion = Prisma.DocumentGetPayload<{
  include: {
    department: { select: { id: true; name: true; code: true; status: true } }
    versions: { orderBy: { versionNumber: 'desc' }; take: 1; include: { storedFile: true; uploadedBy: { select: { id: true; fullName: true } } } }
  }
}>

const latestVersion = {
  versions: {
    orderBy: { versionNumber: 'desc' as const },
    take: 1,
    include: { storedFile: true, uploadedBy: { select: { id: true, fullName: true } } },
  },
}
const adminInclude = {
  department: { select: { id: true, name: true, code: true, status: true } },
  ...latestVersion,
}

function managedDepartmentIds(user: AuthUser) {
  return departmentScope(user).departmentId?.in ?? []
}

function assertManaged(user: AuthUser, document: Pick<DocumentRecord, 'departmentId'>) {
  if (hasRole(user, 'BOARD')) return
  if (!hasRole(user, 'DEPARTMENT_MANAGER') || !document.departmentId || !canAccessDepartment(user, document.departmentId)) {
    throw notFound()
  }
}

function assertScopeAllowed(user: AuthUser, scope: 'DEPARTMENT' | 'CLUB', departmentId: string | null) {
  if (scope === 'DEPARTMENT' && !departmentId) throw zodFieldError('departmentId', 'Chọn ban sở hữu tài liệu.')
  if (hasRole(user, 'BOARD')) return
  if (scope === 'CLUB') throw forbidden('Quản lý Ban chỉ được phân quyền tài liệu trong ban mình.')
  if (!departmentId || !managedDepartmentIds(user).includes(departmentId)) {
    throw forbidden('Chỉ được phân quyền tài liệu trong ban mình.')
  }
}

async function assertActiveDepartment(departmentId: string | null) {
  if (!departmentId) return
  const department = await db.department.findUnique({ where: { id: departmentId }, select: { status: true } })
  if (!department) throw zodFieldError('departmentId', 'Ban không tồn tại.')
  if (department.status !== 'ACTIVE') throw zodFieldError('departmentId', 'Ban đã lưu trữ, không thể nhận tài liệu mới.')
}

function zodFieldError(field: string, message: string) {
  return new z.ZodError([{ code: 'custom', path: [field], message, input: undefined }])
}

async function loadManagedDocument(user: AuthUser, id: string, tx = db) {
  const document = await tx.document.findUnique({ where: { id }, select: { id: true, departmentId: true, scope: true, status: true, updatedAt: true } })
  if (!document) throw notFound()
  assertManaged(user, document)
  return document
}

function assertFresh(updatedAt: string, actual: Date) {
  if (new Date(updatedAt).getTime() !== actual.getTime()) throw conflict('Tài liệu vừa được người khác cập nhật. Vui lòng tải lại.')
}

async function touchDocument(tx: Prisma.TransactionClient, id: string, expectedUpdatedAt: string, data: Prisma.DocumentUncheckedUpdateManyInput = {}) {
  const { count } = await tx.document.updateMany({
    where: { id, updatedAt: new Date(expectedUpdatedAt) },
    data: { ...data, updatedAt: new Date(Math.max(Date.now(), new Date(expectedUpdatedAt).getTime() + 1)) },
  })
  if (!count) throw conflict('Tài liệu vừa được người khác cập nhật. Vui lòng tải lại.')
}

async function assertDocumentFile(storedFileId: string, uploadedById: string) {
  const file = await db.storedFile.findFirst({
    where: { id: storedFileId, purpose: 'DOCUMENT', visibility: 'INTERNAL', uploadedById },
    select: { id: true },
  })
  if (!file) throw zodFieldError('storedFileId', 'Tệp không hợp lệ hoặc không phải tài liệu nội bộ.')
  return file
}

function serializeDocument(document: DocWithVersion) {
  const version = document.versions[0]
  return {
    id: document.id,
    title: document.title,
    description: document.description,
    category: document.category,
    department: document.department,
    departmentId: document.departmentId,
    scope: document.scope,
    allowedRoles: document.allowedRoles,
    status: document.status,
    updatedAt: document.updatedAt,
    createdAt: document.createdAt,
    currentVersion: version
      ? {
          id: version.id,
          versionNumber: version.versionNumber,
          originalName: version.storedFile.originalName,
          mimeType: version.storedFile.mimeType,
          size: version.storedFile.size,
          scanStatus: version.storedFile.scanStatus,
          createdAt: version.createdAt,
          uploadedBy: version.uploadedBy,
        }
      : null,
  }
}

function serializeVersion(version: { id: string; versionNumber: number; createdAt: Date }) {
  return { id: version.id, versionNumber: version.versionNumber, createdAt: version.createdAt }
}

export async function listAdminDocuments(user: AuthUser, rawQuery: unknown) {
  const query = listQuerySchema.parse(rawQuery)
  const where: Prisma.DocumentWhereInput = {
    ...(query.status === 'ALL' ? {} : { status: query.status }),
    ...(!hasRole(user, 'BOARD') ? { departmentId: { in: managedDepartmentIds(user) } } : {}),
  }
  const [items, total] = await db.$transaction([
    db.document.findMany({ where, include: adminInclude, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], ...pageArgs(query) }),
    db.document.count({ where }),
  ])
  return toPage(items.map(serializeDocument), total, query)
}

export async function getAdminDocument(user: AuthUser, rawId: unknown) {
  const { id } = documentParams.parse(rawId)
  const document = await db.document.findUnique({ where: { id }, include: adminInclude })
  if (!document) throw notFound()
  assertManaged(user, document)
  return serializeDocument(document)
}

export async function createDocument(request: AdminActor, rawInput: unknown) {
  const input = createSchema.parse(rawInput)
  const user = currentUser(request)
  assertScopeAllowed(user, input.scope, input.departmentId ?? null)
  await assertActiveDepartment(input.departmentId ?? null)
  await assertDocumentFile(input.storedFileId, user.id)
  const document = await db.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        departmentId: input.departmentId ?? null,
        scope: input.scope,
        allowedRoles: input.allowedRoles,
        createdById: user.id,
        versions: { create: { versionNumber: 1, storedFileId: input.storedFileId, uploadedById: user.id } },
      },
      include: adminInclude,
    })
    await audit(request, {
      action: AUDIT_ACTIONS.DOCUMENT_UPLOAD,
      targetType: 'DOCUMENT',
      targetId: created.id,
      category: AuditCategory.BUSINESS,
      result: AuditResult.SUCCESS,
      reason: input.reason,
      metadata: { scope: created.scope, departmentId: created.departmentId, allowedRoles: created.allowedRoles, versionId: created.versions[0]?.id },
    }, tx)
    return created
  })
  return serializeDocument(document)
}

export async function updateDocument(request: AdminActor, rawId: unknown, rawInput: unknown) {
  const { id } = documentParams.parse(rawId)
  const input = updateSchema.parse(rawInput)
  const user = currentUser(request)
  return db.$transaction(async (tx) => {
    const current = await tx.document.findUnique({ where: { id } })
    if (!current) throw notFound()
    assertManaged(user, current)
    assertFresh(input.updatedAt, current.updatedAt)
    assertScopeAllowed(user, input.scope, input.departmentId ?? null)
    if ((input.departmentId ?? null) !== current.departmentId) await assertActiveDepartment(input.departmentId ?? null)
    await touchDocument(tx, id, input.updatedAt, {
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        departmentId: input.departmentId ?? null,
        scope: input.scope,
        allowedRoles: input.allowedRoles,
    })
    const updated = await tx.document.findUniqueOrThrow({ where: { id }, include: adminInclude })
    await audit(request, {
      action: AUDIT_ACTIONS.DOCUMENT_UPDATE_PERMISSION,
      targetType: 'DOCUMENT', targetId: id, category: AuditCategory.BUSINESS, result: AuditResult.SUCCESS,
      reason: input.reason,
      metadata: { scope: updated.scope, departmentId: updated.departmentId, allowedRoles: updated.allowedRoles },
    }, tx)
    return serializeDocument(updated)
  })
}

async function nextVersion(tx: Prisma.TransactionClient, documentId: string, storedFileId: string, uploadedById: string) {
  const last = await tx.documentVersion.findFirst({ where: { documentId }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true } })
  return tx.documentVersion.create({ data: { documentId, storedFileId, uploadedById, versionNumber: (last?.versionNumber ?? 0) + 1 } })
}

export async function replaceDocumentFile(request: AdminActor, rawId: unknown, rawInput: unknown) {
  const { id } = documentParams.parse(rawId)
  const input = fileActionSchema.parse(rawInput)
  const user = currentUser(request)
  await assertDocumentFile(input.storedFileId, user.id)
  return db.$transaction(async (tx) => {
    const document = await tx.document.findUnique({ where: { id } })
    if (!document) throw notFound()
    assertManaged(user, document)
    assertFresh(input.updatedAt, document.updatedAt)
    if (document.status !== 'ACTIVE') throw conflict('Không thể thay tệp của tài liệu đã lưu trữ.')
    const version = await nextVersion(tx, id, input.storedFileId, user.id)
    await touchDocument(tx, id, input.updatedAt)
    await audit(request, {
      action: AUDIT_ACTIONS.DOCUMENT_REPLACE,
      targetType: 'DOCUMENT', targetId: id, category: AuditCategory.BUSINESS, result: AuditResult.SUCCESS,
      reason: input.reason, metadata: { versionId: version.id, versionNumber: version.versionNumber },
    }, tx)
    return serializeVersion(version)
  })
}

export async function listAdminVersions(user: AuthUser, rawParams: unknown) {
  const { id } = documentParams.parse(rawParams)
  await loadManagedDocument(user, id)
  const versions = await db.documentVersion.findMany({
    where: { documentId: id }, orderBy: { versionNumber: 'desc' },
    include: { storedFile: { select: { originalName: true, mimeType: true, size: true, scanStatus: true } }, uploadedBy: { select: { id: true, fullName: true } } },
  })
  return versions.map((version) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    createdAt: version.createdAt,
    isCurrent: versions[0]?.id === version.id,
    storedFile: version.storedFile,
    uploadedBy: version.uploadedBy,
  }))
}

export async function restoreDocumentVersion(request: AdminActor, rawParams: unknown, rawInput: unknown) {
  const { id, versionId } = versionParams.parse(rawParams)
  const input = stateActionSchema.extend({ updatedAt: z.iso.datetime() }).parse(rawInput)
  const user = currentUser(request)
  return db.$transaction(async (tx) => {
    const document = await tx.document.findUnique({ where: { id } })
    if (!document) throw notFound()
    assertManaged(user, document)
    assertFresh(input.updatedAt, document.updatedAt)
    const old = await tx.documentVersion.findFirst({
      where: { id: versionId, documentId: id, storedFile: { scanStatus: 'CLEAN' } },
      select: { storedFileId: true },
    })
    if (!old) throw notFound()
    const version = await nextVersion(tx, id, old.storedFileId, user.id)
    await touchDocument(tx, id, input.updatedAt)
    await audit(request, {
      action: AUDIT_ACTIONS.DOCUMENT_REPLACE,
      targetType: 'DOCUMENT', targetId: id, category: AuditCategory.BUSINESS, result: AuditResult.SUCCESS,
      reason: input.reason, metadata: { restoredFromVersionId: versionId, versionId: version.id, versionNumber: version.versionNumber },
    }, tx)
    return serializeVersion(version)
  })
}

async function changeStatus(request: AdminActor, rawId: unknown, rawInput: unknown, status: 'ACTIVE' | 'ARCHIVED') {
  const { id } = documentParams.parse(rawId)
  const input = stateActionSchema.parse(rawInput)
  const user = currentUser(request)
  return db.$transaction(async (tx) => {
    const document = await tx.document.findUnique({ where: { id } })
    if (!document) throw notFound()
    assertManaged(user, document)
    assertFresh(input.updatedAt, document.updatedAt)
    if (document.status === status) throw conflict(status === 'ARCHIVED' ? 'Tài liệu đã được lưu trữ.' : 'Tài liệu đang hoạt động.')
    await touchDocument(tx, id, input.updatedAt, { status })
    const updated = await tx.document.findUniqueOrThrow({ where: { id }, include: adminInclude })
    await audit(request, {
      action: AUDIT_ACTIONS.DOCUMENT_ARCHIVE,
      targetType: 'DOCUMENT', targetId: id, category: AuditCategory.BUSINESS, result: AuditResult.SUCCESS,
      reason: input.reason, metadata: { from: document.status, to: status },
    }, tx)
    return serializeDocument(updated)
  })
}

export const archiveDocument = (request: AdminActor, id: unknown, input: unknown) => changeStatus(request, id, input, 'ARCHIVED')
export const restoreDocument = (request: AdminActor, id: unknown, input: unknown) => changeStatus(request, id, input, 'ACTIVE')

function portalAccessWhere(user: AuthUser): Prisma.DocumentWhereInput {
  if (hasRole(user, 'TECH_ADMIN')) throw notFound()
  if (hasRole(user, 'BOARD')) return { status: 'ACTIVE' }
  const departments = new Set([...(user.departmentId ? [user.departmentId] : []), ...managedDepartmentIds(user)])
  const roles = [...new Set(user.roles.map(({ role }) => role))] as Role[]
  return {
    status: 'ACTIVE',
    OR: [
      { scope: 'CLUB' },
      ...(departments.size ? [{ scope: 'DEPARTMENT' as const, departmentId: { in: [...departments] } }] : []),
    ],
    AND: [{ OR: [{ allowedRoles: { isEmpty: true } }, { allowedRoles: { hasSome: roles } }] }],
  }
}

export async function listPortalDocuments(user: AuthUser, rawQuery: unknown) {
  const query = pageQuery.parse(rawQuery)
  const where = portalAccessWhere(user)
  const [items, total] = await db.$transaction([
    db.document.findMany({ where, include: adminInclude, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], ...pageArgs(query) }),
    db.document.count({ where }),
  ])
  return toPage(items.map(serializeDocument), total, query)
}

export async function getPortalDocument(user: AuthUser, rawId: unknown) {
  const { id } = documentParams.parse(rawId)
  const where = portalAccessWhere(user)
  const document = await db.document.findFirst({ where: { AND: [where, { id }] }, include: adminInclude })
  if (!document) throw notFound()
  return serializeDocument(document)
}

export async function downloadDocumentVersion(
  context: FilesContext,
  user: AuthUser,
  reply: FastifyReply,
  rawParams: unknown,
) {
  const { id, versionId } = versionParams.parse(rawParams)
  const where = portalAccessWhere(user)
  const access = await db.document.findFirst({
    where: { AND: [where, { id }] },
    select: { id: true },
  })
  if (!access) throw notFound()
  const version = await db.documentVersion.findFirst({
    where: { id: versionId, documentId: id, storedFile: { scanStatus: 'CLEAN' } },
    select: { storedFileId: true },
  })
  if (!version) throw notFound()
  return sendStoredFile(context, reply, { id: version.storedFileId, purpose: 'DOCUMENT', visibility: 'INTERNAL' }, 'private, no-store')
}

export async function getDocumentStorageMetadata(request: FastifyRequest, rawParams: unknown, rawInput: unknown) {
  const { id, versionId } = versionParams.parse(rawParams)
  const input = metadataSchema.parse(rawInput)
  const version = await db.documentVersion.findFirst({
    where: { id: versionId, documentId: id },
    select: {
      id: true,
      storedFile: { select: { storageKey: true, size: true, scanStatus: true, mimeType: true, purpose: true, visibility: true } },
    },
  })
  if (!version) throw notFound()
  await audit(request, {
    action: AUDIT_ACTIONS.SYSTEM_INCIDENT_ACCESS,
    targetType: 'DOCUMENT_VERSION', targetId: version.id,
    category: AuditCategory.SECURITY, result: AuditResult.SUCCESS,
    incidentId: input.incidentId, reason: input.reason,
    metadata: { storageKey: version.storedFile.storageKey, size: version.storedFile.size, scanStatus: version.storedFile.scanStatus },
  })
  return { storageKey: version.storedFile.storageKey, size: version.storedFile.size, scanStatus: version.storedFile.scanStatus }
}

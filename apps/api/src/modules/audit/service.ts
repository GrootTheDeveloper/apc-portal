import type { FastifyRequest } from 'fastify'
import { db } from '../../db/client.js'
import {
  AuditActorType,
  AuditCategory,
  AuditResult,
  type Role,
  type Prisma,
  type PrismaClient,
} from '../../db/generated/client.js'
import type { AuthUser } from '../auth/rbac.js'

export { AuditActorType, AuditCategory, AuditResult }

/**
 * Danh sách tên action chuẩn hóa theo nhóm ở Vai trò & quyền (docs/02 §11).
 */
export const AUDIT_ACTIONS = {
  // Tài khoản
  ACCOUNT_CREATE: 'account.create',
  ACCOUNT_LOCK: 'account.lock',
  ACCOUNT_UNLOCK: 'account.unlock',
  ACCOUNT_RESET_PASSWORD: 'account.reset_password',
  ACCOUNT_DEACTIVATE: 'account.deactivate',
  ACCOUNT_REVOKE_SESSION: 'account.revoke_session',
  // Phân quyền
  ROLE_GRANT: 'role.grant',
  ROLE_REVOKE: 'role.revoke',
  ROLE_UPDATE_SCOPE: 'role.update_scope',
  // Tuyển thành viên
  RECRUITMENT_CREATE_ROUND: 'recruitment.create_round',
  APPLICATION_STATUS_CHANGE: 'application.status_change',
  RECRUITMENT_FINALIZE: 'recruitment.finalize',
  APPLICATION_CONVERT_USER: 'application.convert_user',
  RECRUITMENT_EXPORT: 'recruitment.export',
  APPLICATION_WITHDRAW: 'application.withdraw',
  // Thành viên
  MEMBER_IMPORT: 'member.import',
  MEMBER_EXPORT: 'member.export',
  MEMBER_CHANGE_DEPARTMENT: 'member.change_department',
  MEMBER_CHANGE_ROLE: 'member.change_role',
  MEMBER_CHANGE_STATUS: 'member.change_status',
  MEMBER_UPDATE_MANAGED: 'member.update_managed_data',
  // Sự kiện
  EVENT_PUBLISH: 'event.publish',
  EVENT_CANCEL: 'event.cancel',
  EVENT_EXPORT: 'event.export',
  EVENT_CHECKIN: 'event.checkin',
  EVENT_EDIT_CHECKIN: 'event.edit_checkin',
  // Nội dung & dự án
  POST_PUBLISH: 'post.publish',
  POST_UNPUBLISH: 'post.unpublish',
  POST_ARCHIVE: 'post.archive',
  PROJECT_PUBLISH: 'project.publish',
  PROJECT_UNPUBLISH: 'project.unpublish',
  PROJECT_ARCHIVE: 'project.archive',
  // Tài liệu
  DOCUMENT_UPLOAD: 'document.upload',
  DOCUMENT_REPLACE: 'document.replace',
  DOCUMENT_UPDATE_PERMISSION: 'document.update_permission',
  DOCUMENT_ARCHIVE: 'document.archive',
  DOCUMENT_DELETE: 'document.delete',
  // Tổ chức
  ORG_UPDATE_INFO: 'org.update_info',
  ORG_UPDATE_DEPARTMENTS: 'org.update_departments',
  ORG_UPDATE_FEATURED: 'org.update_featured',
  // Email
  EMAIL_RESEND: 'email.resend',
  EMAIL_UPDATE_CONFIG: 'email.update_config',
  EMAIL_UPDATE_STATUS: 'email.update_status',
  // Dữ liệu cá nhân
  DATA_REQUEST_CREATE: 'data_request.create',
  DATA_REQUEST_PROCESS: 'data_request.process',
  DATA_REQUEST_EXPORT: 'data_request.export',
  DATA_REQUEST_UPDATE: 'data_request.update',
  DATA_REQUEST_ANONYMIZE: 'data_request.anonymize',
  DATA_REQUEST_DELETE: 'data_request.delete',
  RETENTION_RUN: 'retention.run',
  RETENTION_DRY_RUN: 'retention.dry_run',
  // Hệ thống & xác thực
  SYSTEM_CONFIG_CHANGE: 'system.config_change',
  SYSTEM_DEPLOY: 'system.deploy',
  SYSTEM_MIGRATION: 'system.migration',
  SYSTEM_BACKUP: 'system.backup',
  SYSTEM_RESTORE: 'system.restore',
  SYSTEM_ROLLBACK: 'system.rollback',
  SYSTEM_INCIDENT_ACCESS: 'system.incident_access',
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_DENIED: 'auth.denied',
  AUTH_TWO_FACTOR_SETUP: 'auth.two_factor_setup',
  AUTH_TWO_FACTOR_VERIFY: 'auth.two_factor_verify',
  AUTH_TWO_FACTOR_RESET: 'auth.two_factor_reset',
} as const

export type AuditActionName = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | string

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'token',
  'secret',
  'totp',
  'recovery',
  'code',
  'answer',
  'cautraloi',
  'cau_tra_loi',
  'content',
  'noidung',
  'noi_dung',
  'tep',
  'filecontent',
  'file_content',
  'body',
]

/**
 * Xóa hẳn khóa nhạy cảm khỏi metadata/details (đệ quy). Không dùng ***MASKED*** (SEC-09).
 */
export function cleanSensitiveData<T = Record<string, any>>(data?: T | null): T | undefined {
  if (data === undefined || data === null) return undefined
  if (typeof data !== 'object') return data

  if (Array.isArray(data)) {
    return data.map((item) => cleanSensitiveData(item)) as unknown as T
  }

  const cleaned: Record<string, any> = {}
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    const keyLower = key.toLowerCase()
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => keyLower.includes(pattern))
    if (!isSensitive) {
      if (typeof value === 'object' && value !== null) {
        cleaned[key] = cleanSensitiveData(value)
      } else {
        cleaned[key] = value
      }
    }
  }

  return cleaned as T
}

// Giữ alias cho tương thích ngược
export const maskSensitiveData = cleanSensitiveData

export type ServiceIdentity = {
  service: string
}

export type AuditRequestLike =
  | FastifyRequest
  | ServiceIdentity
  | {
      user?: AuthUser | null
      ip?: string
      headers?: Record<string, any>
      routeOptions?: { url?: string }
      url?: string
    }
  | null
  | undefined

export type AuditParams = {
  action: AuditActionName
  targetType: string
  targetId?: string | null
  category: AuditCategory
  result: AuditResult
  reason?: string | null
  incidentId?: string | null
  metadata?: Record<string, any> | null
  details?: Record<string, any> | null
}

function resolveUserRole(roles?: { role: Role }[]): Role | null {
  if (!roles || roles.length === 0) return null
  if (roles.some((r) => r.role === 'BOARD')) return 'BOARD'
  if (roles.some((r) => r.role === 'TECH_ADMIN')) return 'TECH_ADMIN'
  if (roles.some((r) => r.role === 'DEPARTMENT_MANAGER')) return 'DEPARTMENT_MANAGER'
  if (roles.some((r) => r.role === 'MEMBER')) return 'MEMBER'
  return roles[0]?.role ?? null
}

/**
 * Ghi nhật ký thao tác dùng chung (B1).
 * - Thành công: truyền `tx` để ghi chung transaction nghiệp vụ.
 * - Thất bại/bị từ chối: luôn ghi ngoài transaction (dùng `db`) để không bị rollback mất dấu vết.
 * - Tác vụ nền: truyền `{ service: '<tên>' }` thay cho `request`.
 */
export async function audit(
  request: AuditRequestLike,
  params: AuditParams,
  tx?: Prisma.TransactionClient | PrismaClient,
) {
  const isService = Boolean(
    request && typeof request === 'object' && 'service' in request && typeof request.service === 'string',
  )

  let actorType: AuditActorType = AuditActorType.USER
  let actorId: string | null = null
  let serviceName: string | null = null
  let actorRole: Role | null = null
  let ipAddress: string | null = null
  let userAgent: string | null = null

  if (isService) {
    actorType = AuditActorType.SERVICE
    serviceName = (request as ServiceIdentity).service
  } else if (request && typeof request === 'object') {
    const req = request as {
      user?: AuthUser | null
      ip?: string
      headers?: Record<string, any>
    }
    actorType = AuditActorType.USER
    actorId = req.user?.id ?? null
    actorRole = resolveUserRole(req.user?.roles)
    ipAddress = req.ip ?? (req.headers?.['x-forwarded-for'] as string) ?? null
    userAgent = (req.headers?.['user-agent'] as string) ?? null
  }

  const rawMetadata = params.metadata ?? params.details ?? null
  const cleanedMetadata = cleanSensitiveData(rawMetadata)

  // Ghi trong transaction nếu thành công và có tx; thất bại thì luôn ghi qua db chính
  const client = params.result === AuditResult.SUCCESS && tx ? tx : db

  return await client.auditLog.create({
    data: {
      actorType,
      actorId,
      serviceName,
      actorRole,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      category: params.category,
      result: params.result,
      reason: params.reason ?? null,
      incidentId: params.incidentId ?? null,
      metadata: (cleanedMetadata as Prisma.InputJsonValue) ?? undefined,
      ipAddress,
      userAgent,
    },
  })
}

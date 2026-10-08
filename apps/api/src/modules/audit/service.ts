import { AuditAction, ResourceType } from '../../db/generated/index.js'
import type { Role } from '../../db/generated/index.js'
import { db } from '../../db/client.js'

export type AuditParams = {
  actorId?: string
  actorRole?: Role
  action: AuditAction
  resourceType: ResourceType
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  isSuccess: boolean
  reason?: string
  details?: Record<string, any>
}

// Hàm mask dữ liệu nhạy cảm
export function maskSensitiveData(details?: Record<string, any>): Record<string, any> | undefined {
  if (!details) return undefined
  
  const sensitiveKeys = ['password', 'token', 'secret', 'passwordhash', 'otp', 'recoverycode', 'code']
  const masked: Record<string, any> = Array.isArray(details) ? [...details] : { ...details }
  
  for (const key of Object.keys(masked)) {
    const isSensitive = sensitiveKeys.some(k => key.toLowerCase().includes(k))
    if (isSensitive) {
      masked[key] = '***MASKED***'
    } else if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskSensitiveData(masked[key])
    }
  }
  
  return masked
}

export async function audit(params: AuditParams) {
  const maskedDetails = maskSensitiveData(params.details)

  return await db.auditLog.create({
    data: {
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      isSuccess: params.isSuccess,
      reason: params.reason,
      // Prisma requires either a valid JSON or undefined/null for Json? field
      details: maskedDetails !== undefined ? maskedDetails : undefined,
    }
  })
}

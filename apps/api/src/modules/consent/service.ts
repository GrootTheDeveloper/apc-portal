import { db } from '../../db/client.js'

export type RecordConsentParams = {
  email: string
  userId?: string
  purpose: string
  privacyVersion: string
  ipAddress?: string
  userAgent?: string
}

export async function recordConsent(params: RecordConsentParams) {
  return await db.consentRecord.create({
    data: {
      email: params.email,
      userId: params.userId ?? null,
      purpose: params.purpose,
      privacyVersion: params.privacyVersion,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  })
}

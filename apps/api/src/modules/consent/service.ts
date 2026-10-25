import { db } from '../../db/client.js'
import type { ConsentPurpose, ConsentSubjectType, Prisma } from '../../db/generated/client.js'

/**
 * Phiên bản chính sách quyền riêng tư hiện hành, lưu kèm mọi lần đồng ý (DATA-07).
 * Đổi nội dung trang /privacy thì tăng ở đây và ở `POLICY_VERSION` trong apps/web/src/pages/privacy/PrivacyPage.tsx.
 */
export const PRIVACY_POLICY_VERSION = '2026-10'

export type ConsentKey = {
  subjectType: ConsentSubjectType
  subjectId: string
  purpose: ConsentPurpose
  /** Đối tượng áp dụng, vd. `PROJECT` + id dự án. Bỏ trống là đồng ý chung. */
  targetType?: string
  targetId?: string
}

/** Đúng một đối tượng: có target thì khớp target đó, không có thì chỉ khớp dòng chung. */
function sameTarget(key: ConsentKey) {
  return { targetType: key.targetType ?? null, targetId: key.targetId ?? null }
}

/**
 * Lưu đồng ý với phiên bản chính sách hiện hành, trong transaction của thao tác gọi nó:
 *   await db.$transaction(async (tx) => {
 *     const app = await tx.membershipApplication.create({ ... })
 *     await recordConsent(tx, { subjectType: 'APPLICATION', subjectId: app.id, purpose: 'RECRUITMENT_PROCESSING' })
 *   })
 */
export function recordConsent(tx: Prisma.TransactionClient, key: ConsentKey) {
  return tx.consentRecord.create({
    data: {
      subjectType: key.subjectType,
      subjectId: key.subjectId,
      purpose: key.purpose,
      ...sameTarget(key),
      policyVersion: PRIVACY_POLICY_VERSION,
    },
  })
}

/** Thu hồi đồng ý đúng đối tượng: ghi revokedAt cho các dòng còn hiệu lực, không xóa dòng. Trả số dòng đã thu hồi. */
export async function revokeConsent(tx: Prisma.TransactionClient, key: ConsentKey) {
  const { count } = await tx.consentRecord.updateMany({
    where: { subjectType: key.subjectType, subjectId: key.subjectId, purpose: key.purpose, ...sameTarget(key), revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return count
}

/** `true` khi còn dòng chưa thu hồi khớp đối tượng cụ thể, hoặc dòng đồng ý chung cho mục đích đó. */
export async function hasActiveConsent(key: ConsentKey) {
  const targets: Prisma.ConsentRecordWhereInput[] = [{ targetType: null, targetId: null }]
  if (key.targetType && key.targetId) targets.push({ targetType: key.targetType, targetId: key.targetId })

  const found = await db.consentRecord.findFirst({
    where: { subjectType: key.subjectType, subjectId: key.subjectId, purpose: key.purpose, revokedAt: null, OR: targets },
    select: { id: true },
  })
  return found !== null
}

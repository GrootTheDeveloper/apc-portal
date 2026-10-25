import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

import { db } from '../../db/client.js'
import { hasActiveConsent, PRIVACY_POLICY_VERSION, recordConsent, revokeConsent } from './service.js'

// Mỗi test một chủ thể riêng; cuối file chỉ dọn các dòng của lần chạy này.
const run = randomUUID().slice(0, 8)
const subjects: string[] = []
function newSubject() {
  const id = `consent-test-${run}-${subjects.length}`
  subjects.push(id)
  return id
}

afterAll(async () => {
  await db.consentRecord.deleteMany({ where: { subjectId: { in: subjects } } })
})

describe('B2: consent service', () => {
  it('recordConsent lưu đúng phiên bản chính sách hiện hành, chạy trong transaction', async () => {
    const subjectId = newSubject()
    const row = await db.$transaction((tx) =>
      recordConsent(tx, { subjectType: 'APPLICATION', subjectId, purpose: 'RECRUITMENT_PROCESSING' }),
    )
    expect(row).toMatchObject({
      subjectType: 'APPLICATION',
      subjectId,
      purpose: 'RECRUITMENT_PROCESSING',
      targetType: null,
      targetId: null,
      policyVersion: PRIVACY_POLICY_VERSION,
      revokedAt: null,
    })
    expect(row.grantedAt).toBeInstanceOf(Date)
  })

  it('transaction rollback thì không còn dòng đồng ý', async () => {
    const subjectId = newSubject()
    await expect(
      db.$transaction(async (tx) => {
        await recordConsent(tx, { subjectType: 'EVENT_REGISTRATION', subjectId, purpose: 'EVENT_REGISTRATION' })
        throw new Error('nghiệp vụ lỗi')
      }),
    ).rejects.toThrow('nghiệp vụ lỗi')
    expect(await db.consentRecord.count({ where: { subjectId } })).toBe(0)
  })

  it('thu hồi xong thì hasActiveConsent trả false, dòng vẫn còn với revokedAt', async () => {
    const key = { subjectType: 'USER', subjectId: newSubject(), purpose: 'PUBLIC_NAME' } as const
    await recordConsent(db, key)
    expect(await hasActiveConsent(key)).toBe(true)

    expect(await revokeConsent(db, key)).toBe(1)
    expect(await hasActiveConsent(key)).toBe(false)
    const rows = await db.consentRecord.findMany({ where: { subjectId: key.subjectId } })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.revokedAt).toBeInstanceOf(Date)
  })

  it('đồng ý cho dự án X không làm dự án Y có hiệu lực', async () => {
    const base = { subjectType: 'USER', subjectId: newSubject(), purpose: 'PUBLIC_PHOTO' } as const
    await recordConsent(db, { ...base, targetType: 'PROJECT', targetId: 'project-x' })

    expect(await hasActiveConsent({ ...base, targetType: 'PROJECT', targetId: 'project-x' })).toBe(true)
    expect(await hasActiveConsent({ ...base, targetType: 'PROJECT', targetId: 'project-y' })).toBe(false)
    // Đồng ý riêng một dự án không phải đồng ý chung
    expect(await hasActiveConsent(base)).toBe(false)
  })

  it('đồng ý chung áp dụng cho mọi dự án; thu hồi riêng dự án X không đụng đồng ý chung', async () => {
    const base = { subjectType: 'USER', subjectId: newSubject(), purpose: 'PUBLIC_PROFILE' } as const
    const projectX = { ...base, targetType: 'PROJECT', targetId: 'project-x' }
    await recordConsent(db, base)
    await recordConsent(db, projectX)

    expect(await hasActiveConsent({ ...base, targetType: 'PROJECT', targetId: 'project-y' })).toBe(true)
    expect(await revokeConsent(db, projectX)).toBe(1)
    expect(await hasActiveConsent(base)).toBe(true)
    expect(await hasActiveConsent(projectX)).toBe(true) // vẫn còn đồng ý chung
  })

  it('khác mục đích thì không tính', async () => {
    const subjectId = newSubject()
    await recordConsent(db, { subjectType: 'USER', subjectId, purpose: 'PUBLIC_NAME' })
    expect(await hasActiveConsent({ subjectType: 'USER', subjectId, purpose: 'PUBLIC_PHOTO' })).toBe(false)
  })
})

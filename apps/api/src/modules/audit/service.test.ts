import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import {
  AUDIT_ACTIONS,
  AuditActorType,
  AuditCategory,
  AuditResult,
  audit,
  cleanSensitiveData,
} from './service.js'
import { requireAuth, requireRole } from '../auth/rbac.js'

describe('B1: Audit Log Service', () => {
  const testUserId = 'test-user-b1'
  // Mỗi lần chạy một tên route riêng để đếm đúng dòng của lần chạy này.
  const run = randomUUID().slice(0, 8)

  beforeAll(async () => {
    // Tạo user mẫu cho test audit liên kết khóa ngoại
    await db.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        username: 'test_audit_user',
        email: 'test_audit_user@example.com',
        fullName: 'Test Audit User',
        passwordHash: 'dummy-hash',
      },
    })
  })

  afterAll(async () => {
    // Dọn dẹp logs và user sau test
    // Chỉ dọn dòng do test này tạo (không đụng nhật ký thật).
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: testUserId },
          { serviceName: { in: ['test-job', 'test-audit'] } },
          { targetId: { contains: run } },
        ],
      },
    })
    await db.user.deleteMany({
      where: { id: testUserId },
    })
  })

  it('gọi audit(...) tạo đúng một dòng với đủ trường', async () => {
    const fakeRequest = {
      user: {
        id: testUserId,
        departmentId: 'dept-test',
        roles: [{ role: 'BOARD' as const, departmentId: null }],
      },
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Vitest-Agent/1.0',
      },
    }

    const log = await audit(fakeRequest as any, {
      action: 'account.create',
      targetType: 'USER',
      targetId: 'target-u-123',
      category: AuditCategory.BUSINESS,
      result: AuditResult.SUCCESS,
      reason: 'Tạo tài khoản thành viên mới',
      incidentId: 'INC-20261025-01',
      metadata: {
        fullName: 'Nguyễn Văn A',
        department: 'Ban Kỹ thuật',
      },
    })

    expect(log).toBeDefined()
    expect(log.id).toBeDefined()
    expect(log.actorType).toBe(AuditActorType.USER)
    expect(log.actorId).toBe(testUserId)
    expect(log.actorRole).toBe('BOARD')
    expect(log.action).toBe('account.create')
    expect(log.targetType).toBe('USER')
    expect(log.targetId).toBe('target-u-123')
    expect(log.category).toBe(AuditCategory.BUSINESS)
    expect(log.result).toBe(AuditResult.SUCCESS)
    expect(log.reason).toBe('Tạo tài khoản thành viên mới')
    expect(log.incidentId).toBe('INC-20261025-01')
    expect(log.ipAddress).toBe('127.0.0.1')
    expect(log.userAgent).toBe('Vitest-Agent/1.0')
    expect((log.metadata as any)?.fullName).toBe('Nguyễn Văn A')
  })

  it('gọi route requireRole("BOARD") bằng tài khoản MEMBER tạo một dòng SECURITY / FAILURE', async () => {
    const app = buildApp(loadConfig({ NODE_ENV: 'test' }))

    app.addHook('onRequest', async (req) => {
      // Giả lập tài khoản MEMBER
      req.user = {
        id: testUserId,
        departmentId: null,
        roles: [{ role: 'MEMBER', departmentId: null }],
      }
    })

    app.get('/admin/test-board-only', { preHandler: requireRole('BOARD') }, async () => ({
      ok: true,
    }))

    const res = await app.inject({
      method: 'GET',
      url: '/admin/test-board-only',
    })

    // denied() chờ ghi xong trước khi trả 403, nên đọc ngay được dòng nhật ký.
    expect(res.statusCode).toBe(403)

    const deniedLogs = await db.auditLog.findMany({
      where: {
        actorId: testUserId,
        action: 'auth.denied',
        category: AuditCategory.SECURITY,
        result: AuditResult.FAILURE,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })

    expect(deniedLogs.length).toBeGreaterThan(0)
    const deniedLog = deniedLogs[0]!
    expect(deniedLog.actorType).toBe(AuditActorType.USER)
    expect(deniedLog.category).toBe(AuditCategory.SECURITY)
    expect(deniedLog.result).toBe(AuditResult.FAILURE)
    expect(deniedLog.targetType).toBe('ROUTE')
    expect(deniedLog.targetId).toBe('/admin/test-board-only')
  })

  it('metadata chứa password, profileCode hoặc answers (kể cả lồng trong object con) thì các khóa đó không có trong dòng đã lưu', async () => {
    const rawMetadata = {
      username: 'johndoe',
      password: 'super-secret-password',
      profileCode: 'CSPRNG-CODE-12345',
      userToken: 'token-abc',
      nested: {
        recoveryCode: 'rec-123',
        totpSecret: 'base32secret',
        answers: ['A', 'B', 'C'],
        validField: 'allowed',
        deepNested: {
          innerPassword: 'deep-secret',
          okField: 42,
        },
      },
      arrayItems: [
        { secretValue: 'leak', publicValue: 'ok' },
        { content: 'form body', title: 'clean' },
      ],
    }

    const cleaned = cleanSensitiveData(rawMetadata)

    expect(cleaned).toEqual({
      username: 'johndoe',
      nested: {
        validField: 'allowed',
        deepNested: {
          okField: 42,
        },
      },
      arrayItems: [{ publicValue: 'ok' }, { title: 'clean' }],
    })

    // Lưu vào database thực tế và kiểm tra
    const log = await audit({ service: 'test-audit' }, {
      action: AUDIT_ACTIONS.ACCOUNT_CREATE,
      targetType: 'TEST_TARGET',
      category: AuditCategory.BUSINESS,
      result: AuditResult.SUCCESS,
      metadata: rawMetadata,
    })

    const meta = log.metadata as Record<string, any>
    expect(meta.username).toBe('johndoe')
    expect(meta.password).toBeUndefined()
    expect(meta.profileCode).toBeUndefined()
    expect(meta.userToken).toBeUndefined()
    expect(meta.nested.recoveryCode).toBeUndefined()
    expect(meta.nested.totpSecret).toBeUndefined()
    expect(meta.nested.answers).toBeUndefined()
    expect(meta.nested.validField).toBe('allowed')
    expect(meta.nested.deepNested.innerPassword).toBeUndefined()
    expect(meta.nested.deepNested.okField).toBe(42)
  })

  it('audit(...) thành công trong transaction bị rollback thì không còn dòng nhật ký; dòng FAILURE ghi ngoài transaction vẫn còn', async () => {
    const successTarget = `tx-success-${run}`
    const failureTarget = `tx-failure-${run}`

    // Mô phỏng transaction nghiệp vụ gặp lỗi và rollback
    try {
      await db.$transaction(async (tx) => {
        // Ghi nhật ký thành công TRONG transaction
        await audit(
          { service: 'test-audit' },
          {
            action: AUDIT_ACTIONS.POST_PUBLISH,
            targetType: 'TX_ROLLBACK_TEST',
            targetId: successTarget,
            category: AuditCategory.BUSINESS,
            result: AuditResult.SUCCESS,
            reason: 'Ghi cùng transaction',
          },
          tx,
        )

        // Mô phỏng thao tác thất bại: ghi nhật ký FAILURE NGOÀI transaction (dùng client chính db)
        await audit(
          { service: 'test-audit' },
          {
            action: AUDIT_ACTIONS.POST_PUBLISH,
            targetType: 'TX_ROLLBACK_TEST',
            targetId: failureTarget,
            category: AuditCategory.BUSINESS,
            result: AuditResult.FAILURE,
            reason: 'Thao tác gặp lỗi nghiệp vụ',
          },
          tx, // audit(...) sẽ bỏ qua tx và ghi thẳng qua db khi result = FAILURE
        )

        // Ném lỗi để trigger rollback transaction nghiệp vụ
        throw new Error('Nghiệp vụ thất bại, rollback toàn bộ tx!')
      })
    } catch {
      // Bỏ qua lỗi mong đợi
    }

    // Kiểm tra dòng SUCCESS trong transaction bị rollback: KHÔNG còn
    const successLog = await db.auditLog.findFirst({ where: { targetId: successTarget } })
    expect(successLog).toBeNull()

    // Kiểm tra dòng FAILURE ngoài transaction: VẪN CÒN
    const failureLog = await db.auditLog.findFirst({ where: { targetId: failureTarget } })
    expect(failureLog).not.toBeNull()
    expect(failureLog?.result).toBe(AuditResult.FAILURE)
  })

  it('audit({ service: "test-job" }, ...) lưu actorType = SERVICE, actorId rỗng', async () => {
    const log = await audit(
      { service: 'test-job' },
      {
        action: 'retention.dry_run',
        targetType: 'SYSTEM',
        category: AuditCategory.OPERATIONS,
        result: AuditResult.SUCCESS,
        reason: 'Chạy tác vụ kiểm tra retention tự động',
      },
    )

    expect(log).toBeDefined()
    expect(log.actorType).toBe(AuditActorType.SERVICE)
    expect(log.serviceName).toBe('test-job')
    expect(log.actorId).toBeNull()
    expect(log.actorRole).toBeNull()
    expect(log.action).toBe('retention.dry_run')
    expect(log.category).toBe(AuditCategory.OPERATIONS)
  })

  it('401 của khách không có cookie phiên không ghi nhật ký; cookie phiên sai thì ghi SECURITY / FAILURE', async () => {
    const app = buildApp(loadConfig({ NODE_ENV: 'test' }))
    const route = `/portal/test-auth-${run}`
    app.get(route, { preHandler: requireAuth }, async () => ({ ok: true }))

    const guest = await app.inject({ method: 'GET', url: route })
    expect(guest.statusCode).toBe(401)
    expect(await db.auditLog.count({ where: { targetId: route } })).toBe(0)

    const badSession = await app.inject({ method: 'GET', url: route, cookies: { apc_session: 'phien-khong-ton-tai' } })
    expect(badSession.statusCode).toBe(401)
    const rows = await db.auditLog.findMany({ where: { targetId: route } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ action: AUDIT_ACTIONS.AUTH_DENIED, category: AuditCategory.SECURITY, result: AuditResult.FAILURE, actorId: null })
    await app.close()
  })
})

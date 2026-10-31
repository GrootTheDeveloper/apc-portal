import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'
import { ZodError } from 'zod'

import { db } from '../../db/client.js'
import type { Prisma } from '../../db/generated/client.js'
import { verifyPassword } from '../../lib/password.js'
import { BOOTSTRAP_REASON, BootstrapRefused, runBootstrapInTx } from './bootstrap.js'

// A7 — mỗi test chạy trong transaction rồi rollback, giả lập "database trống" (không BOARD/TECH_ADMIN ACTIVE,
// chưa có tài khoản bootstrap, chưa có termEndsAt) mà không đụng dữ liệu thật.
type Tx = Prisma.TransactionClient
const tag = randomUUID().slice(0, 8)

const input = (overrides: { board?: object; tech?: object } = {}) => ({
  board: { username: `chu.nhiem-${tag}`, email: `chu.nhiem-${tag}@test.local`, fullName: 'Chủ nhiệm đầu tiên', ...overrides.board },
  tech: { username: `van.hanh-${tag}`, email: `van.hanh-${tag}@test.local`, fullName: 'Vận hành đầu tiên', ...overrides.tech },
  termEndsAt: '2027-06-30',
})

/** Số user do file test này tạo (theo hậu tố tag), không bị lệch khi file test khác chạy song song. */
const ours = (tx: Tx) => tx.user.count({ where: { username: { endsWith: `-${tag}` } } })

async function onEmptyDatabase(check: (tx: Tx) => Promise<void>) {
  const rollback = new Error('rollback')
  await db
    .$transaction(
      async (tx) => {
        // Chặn file test khác ghi user_roles đến khi rollback, để trạng thái "trống" không bị chen vào.
        await tx.$executeRaw`LOCK TABLE "user_roles" IN SHARE ROW EXCLUSIVE MODE`
        await tx.userRole.updateMany({ where: { role: { in: ['BOARD', 'TECH_ADMIN'] }, status: 'ACTIVE' }, data: { status: 'EXPIRED' } })
        await tx.userRole.updateMany({ where: { reason: BOOTSTRAP_REASON, status: 'PENDING' }, data: { status: 'REVOKED' } })
        await tx.siteSetting.deleteMany({})
        await check(tx)
        throw rollback
      },
      { timeout: 30_000 },
    )
    .catch((error) => {
      if (error !== rollback) throw error
    })
}

afterAll(() => db.$disconnect())

describe('bootstrap (RP-15, AC-RBAC-09)', () => {
  it('creates exactly two PENDING accounts with BOARD and TECH_ADMIN pending until term end, audited as service:bootstrap', async () => {
    await onEmptyDatabase(async (tx) => {
      const result = await runBootstrapInTx(tx, input())
      expect(result.status).toBe('created')
      expect(result.accounts.map((account) => account.role)).toEqual(['BOARD', 'TECH_ADMIN'])
      expect(await ours(tx)).toBe(2)

      const users = await tx.user.findMany({
        where: { username: { in: result.accounts.map((account) => account.username) } },
        include: { roles: true },
        orderBy: { username: 'asc' },
      })
      for (const user of users) {
        expect(user).toMatchObject({ status: 'PENDING_ACTIVATION', mustChangePassword: true, isTemporaryPassword: true })
        expect(user.roles).toHaveLength(1)
        expect(user.roles[0]).toMatchObject({ status: 'PENDING', reason: 'bootstrap' })
        expect(user.roles[0]!.expiresAt!.toISOString()).toBe('2027-06-30T16:59:59.000Z') // 23:59:59 giờ Việt Nam
      }
      // Database trống chưa có site_settings: không tạo dòng rỗng (sẽ làm /public/about lỗi 500), báo nhập ở trang Thông tin APC.
      expect(result.termEndsAtSaved).toBe(false)
      expect(await tx.siteSetting.count()).toBe(0)

      const logs = await tx.auditLog.findMany({ where: { targetId: { in: users.map((user) => user.id) } } })
      expect(logs.length).toBeGreaterThanOrEqual(4) // tạo tài khoản + gán vai trò cho mỗi người
      expect(logs.every((log) => log.actorType === 'SERVICE' && log.serviceName === 'bootstrap')).toBe(true)
      const dump = JSON.stringify(logs)
      for (const account of result.accounts) expect(dump).not.toContain(account.temporaryPassword)
    })
  })

  it('refuses and changes nothing when an active BOARD or TECH_ADMIN already exists', async () => {
    await onEmptyDatabase(async (tx) => {
      const existing = await tx.user.create({
        data: { username: `da-co-${tag}`, email: `da-co-${tag}@test.local`, passwordHash: 'x', fullName: 'Đã có', status: 'ACTIVE' },
      })
      await tx.userRole.create({ data: { userId: existing.id, role: 'TECH_ADMIN', status: 'ACTIVE', startsAt: new Date(), reason: 'test' } })
      await expect(runBootstrapInTx(tx, input())).rejects.toBeInstanceOf(BootstrapRefused)
      expect(await ours(tx)).toBe(1) // chỉ tài khoản "đã có" ở trên, bootstrap không tạo thêm
    })
  })

  it('on a re-run while both bootstrap accounts are still pending, only issues new temporary passwords', async () => {
    await onEmptyDatabase(async (tx) => {
      const first = await runBootstrapInTx(tx, input())
      const again = await runBootstrapInTx(tx, null)
      expect(again.status).toBe('reissued')
      expect(await ours(tx)).toBe(2)
      expect(again.accounts.map((account) => account.username).sort()).toEqual(first.accounts.map((account) => account.username).sort())
      for (const account of again.accounts) {
        const previous = first.accounts.find((item) => item.username === account.username)!
        expect(account.temporaryPassword).not.toBe(previous.temporaryPassword)
        const user = await tx.user.findUniqueOrThrow({ where: { username: account.username } })
        expect(await verifyPassword(user.passwordHash, account.temporaryPassword)).toBe(true)
        expect(await verifyPassword(user.passwordHash, previous.temporaryPassword)).toBe(false)
      }
    })
  })

  it('saves termEndsAt into an existing site_settings row that has none yet', async () => {
    await onEmptyDatabase(async (tx) => {
      await tx.siteSetting.create({ data: { info: { name: 'APC' }, termEndsAt: null } })
      const result = await runBootstrapInTx(tx, input())
      expect(result.termEndsAtSaved).toBe(true)
      const setting = await tx.siteSetting.findFirstOrThrow()
      expect(setting.termEndsAt!.toISOString()).toBe('2027-06-30T16:59:59.000Z')
      expect(setting.info).toEqual({ name: 'APC' }) // không đụng nội dung giới thiệu
    })
  })

  it('still reissues the BOARD temporary password when TECH_ADMIN activated first (no manual DB fix)', async () => {
    await onEmptyDatabase(async (tx) => {
      const first = await runBootstrapInTx(tx, input())
      const tech = first.accounts.find((account) => account.role === 'TECH_ADMIN')!
      const techUser = await tx.user.findUniqueOrThrow({ where: { username: tech.username } })
      // TECH_ADMIN kích hoạt và thiết lập 2 lớp xong: vai trò ACTIVE. Mật khẩu tạm của BOARD đã quá 72 giờ.
      await tx.user.update({ where: { id: techUser.id }, data: { status: 'ACTIVE', mustChangePassword: false, isTemporaryPassword: false } })
      await tx.userRole.updateMany({ where: { userId: techUser.id }, data: { status: 'ACTIVE' } })
      const board = first.accounts.find((account) => account.role === 'BOARD')!
      await tx.user.update({ where: { username: board.username }, data: { temporaryPasswordExpiresAt: new Date(Date.now() - 1000) } })

      const again = await runBootstrapInTx(tx, null)
      expect(again.status).toBe('reissued')
      expect(again.accounts.map((account) => account.role)).toEqual(['BOARD'])
      const boardUser = await tx.user.findUniqueOrThrow({ where: { username: board.username } })
      expect(boardUser.temporaryPasswordExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 71 * 3600 * 1000)
      expect(await verifyPassword(boardUser.passwordHash, again.accounts[0]!.temporaryPassword)).toBe(true)
      // TECH_ADMIN đã kích hoạt không bị cấp lại mật khẩu.
      expect((await tx.user.findUniqueOrThrow({ where: { id: techUser.id } })).isTemporaryPassword).toBe(false)
    })
  })

  it('rejects the same username or email for both people before writing anything', async () => {
    await onEmptyDatabase(async (tx) => {
      await expect(runBootstrapInTx(tx, input({ tech: { username: `chu.nhiem-${tag}` } }))).rejects.toBeInstanceOf(ZodError)
      await expect(runBootstrapInTx(tx, input({ tech: { email: `chu.nhiem-${tag}@test.local` } }))).rejects.toBeInstanceOf(ZodError)
      await expect(runBootstrapInTx(tx, { ...input(), termEndsAt: '30/06/2027' })).rejects.toBeInstanceOf(ZodError)
      await expect(runBootstrapInTx(tx, null)).rejects.toBeInstanceOf(BootstrapRefused)
      expect(await ours(tx)).toBe(0)
    })
  })
})

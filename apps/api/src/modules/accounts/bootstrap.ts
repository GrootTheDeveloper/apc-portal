import { z } from 'zod'

import type { Prisma } from '../../db/generated/client.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult } from '../audit/service.js'
import { createAccount, createAccountSchema, reissueTemporaryPassword } from './service.js'

// A7 — tạo BOARD đầu tiên và TECH_ADMIN đầu tiên trên production trống (RP-15, PRD §11 mục 13, AC-RBAC-09).
// Chỉ chạy từ console VPS (src/scripts/bootstrap.ts); KHÔNG có endpoint HTTP.

type Tx = Prisma.TransactionClient
const SERVICE = { service: 'bootstrap' } as const
export const BOOTSTRAP_REASON = 'bootstrap'

const person = createAccountSchema.pick({ username: true, email: true, fullName: true })

export const bootstrapInputSchema = z
  .object({
    board: person,
    tech: person,
    termEndsAt: z.iso.date({ error: 'Ngày kết thúc nhiệm kỳ có dạng YYYY-MM-DD.' }),
  })
  .superRefine((value, ctx) => {
    // BR-21: hai vai trò đặc quyền do hai người khác nhau giữ.
    if (value.board.username === value.tech.username) {
      ctx.addIssue({ code: 'custom', path: ['tech', 'username'], message: 'Hai người phải khác tên đăng nhập.' })
    }
    if (value.board.email === value.tech.email) {
      ctx.addIssue({ code: 'custom', path: ['tech', 'email'], message: 'Hai người phải khác email.' })
    }
  })
export type BootstrapInput = z.input<typeof bootstrapInputSchema>

export class BootstrapRefused extends Error {}

export type BootstrapResult = {
  status: 'created' | 'reissued'
  accounts: { role: 'BOARD' | 'TECH_ADMIN'; username: string; temporaryPassword: string; expiresAt: Date }[]
}

/** Hết ngày đã chọn theo giờ Việt Nam (23:59:59 +07:00), lưu UTC (BR-14). */
const endOfVnDay = (date: string) => new Date(`${date}T23:59:59+07:00`)

/**
 * Chạy bootstrap trong transaction `tx`:
 * - Đã có BOARD hoặc TECH_ADMIN ACTIVE → từ chối, không đổi gì (bootstrap đã hoàn tất, FLOW-27).
 * - Đã có hai tài khoản bootstrap chưa ai ACTIVE → không tạo mới, chỉ cấp lại mật khẩu tạm cho hai tài khoản đó.
 * - Còn lại → tạo hai tài khoản PENDING_ACTIVATION, dòng BOARD và TECH_ADMIN ở PENDING hết hạn cuối nhiệm kỳ,
 *   ghi termEndsAt nếu đang trống, audit với định danh dịch vụ `bootstrap`.
 * Mật khẩu tạm chỉ nằm trong giá trị trả về để CLI in ra một lần.
 */
export async function runBootstrapInTx(tx: Tx, input: BootstrapInput | null, now = new Date()): Promise<BootstrapResult> {
  const active = await tx.userRole.count({ where: { role: { in: ['BOARD', 'TECH_ADMIN'] }, status: 'ACTIVE' } })
  if (active > 0) {
    throw new BootstrapRefused('Đã có Ban Chủ nhiệm hoặc quản trị viên kỹ thuật đang hoạt động: bootstrap đã hoàn tất, không chạy lại.')
  }

  const existing = await tx.userRole.findMany({
    where: { role: { in: ['BOARD', 'TECH_ADMIN'] }, status: 'PENDING', reason: BOOTSTRAP_REASON },
    select: { role: true, user: { select: { id: true, username: true, status: true } } },
    orderBy: { role: 'asc' },
  })
  if (existing.length > 0) {
    const accounts: BootstrapResult['accounts'] = []
    for (const row of existing) {
      if (row.user.status === 'INACTIVE') continue
      const { temporaryPassword, expiresAt } = await reissueTemporaryPassword(tx, SERVICE, row.user.id, 'bootstrap: cấp lại mật khẩu tạm', now)
      accounts.push({ role: row.role as 'BOARD' | 'TECH_ADMIN', username: row.user.username, temporaryPassword, expiresAt })
    }
    return { status: 'reissued', accounts }
  }

  if (!input) throw new BootstrapRefused('Chưa có tài khoản bootstrap: cần thông tin hai người và ngày kết thúc nhiệm kỳ.')
  const data = bootstrapInputSchema.parse(input)
  const termEndsAt = endOfVnDay(data.termEndsAt)
  if (termEndsAt <= now) throw new BootstrapRefused('Ngày kết thúc nhiệm kỳ phải ở tương lai.')

  const accounts: BootstrapResult['accounts'] = []
  for (const [role, who] of [
    ['BOARD', data.board],
    ['TECH_ADMIN', data.tech],
  ] as const) {
    const { user, temporaryPassword } = await createAccount(tx, SERVICE, { ...who, departmentId: null }, now)
    const row = await tx.userRole.create({
      data: { userId: user.id, role, status: 'PENDING', startsAt: now, expiresAt: termEndsAt, reason: BOOTSTRAP_REASON },
    })
    await audit(
      SERVICE,
      {
        action: AUDIT_ACTIONS.ROLE_GRANT,
        targetType: 'USER',
        targetId: user.id,
        category: AuditCategory.SECURITY,
        result: AuditResult.SUCCESS,
        reason: BOOTSTRAP_REASON,
        metadata: { role, status: 'PENDING', userRoleId: row.id },
      },
      tx,
    )
    const user72h = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { temporaryPasswordExpiresAt: true } })
    accounts.push({ role, username: user.username, temporaryPassword, expiresAt: user72h.temporaryPasswordExpiresAt! })
  }

  // QĐ-6: một nguồn duy nhất cho ngày kết thúc nhiệm kỳ; chỉ ghi khi đang trống.
  const setting = await tx.siteSetting.findFirst({ select: { id: true, termEndsAt: true } })
  if (!setting) await tx.siteSetting.create({ data: { info: {}, termEndsAt } })
  else if (!setting.termEndsAt) await tx.siteSetting.update({ where: { id: setting.id }, data: { termEndsAt } })

  return { status: 'created', accounts }
}

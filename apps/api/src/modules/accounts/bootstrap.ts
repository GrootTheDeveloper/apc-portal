import { z } from 'zod'

import type { Prisma } from '../../db/generated/client.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult } from '../audit/service.js'
import { lockPrivilegedRoles } from './privileged.js'
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
  /** false khi chưa có dòng site_settings: phải nhập ngày kết thúc nhiệm kỳ ở trang Thông tin APC (T4). */
  termEndsAtSaved: boolean
}

/** Hết ngày đã chọn theo giờ Việt Nam (23:59:59 +07:00), lưu UTC (BR-14). */
const endOfVnDay = (date: string) => new Date(`${date}T23:59:59+07:00`)

/**
 * Chạy bootstrap trong transaction `tx`. Dòng bootstrap nhận diện bằng `grantedById: null` + lý do `bootstrap`
 * (A6 luôn ghi người cấp, nên BOARD gõ lý do "bootstrap" ở trang vai trò cũng không giả được):
 * - Còn dòng bootstrap PENDING (chưa kích hoạt xong) → chỉ cấp lại mật khẩu tạm cho (các) tài khoản đó, kể cả khi
 *   người kia đã ACTIVE (vd TECH_ADMIN xong trước, mật khẩu tạm của BOARD quá 72 giờ). Bắt buộc có đúng một dòng
 *   bootstrap BOARD và một dòng TECH_ADMIN còn hiệu lực; thiếu (vd một dòng đã bị thu hồi) thì từ chối.
 * - Không còn dòng bootstrap chờ mà đã có BẤT KỲ dòng BOARD/TECH_ADMIN nào (ACTIVE, hết hạn hay đã thu hồi) → từ chối:
 *   bootstrap đã hoàn tất và không mở lại (AC-RBAC-09, FLOW-27).
 * - Database chưa từng có vai trò đặc quyền → tạo hai tài khoản PENDING_ACTIVATION, dòng BOARD và TECH_ADMIN ở PENDING
 *   hết hạn cuối nhiệm kỳ, audit với định danh dịch vụ `bootstrap`.
 * Ngày kết thúc nhiệm kỳ (QĐ-6, một nguồn duy nhất): site_settings đã có `termEndsAt` thì ngày nhập không được muộn
 * hơn; dòng site_settings có mà `termEndsAt` trống thì ghi vào (có audit); chưa có dòng thì KHÔNG tạo (cột `info`
 * bắt buộc nội dung giới thiệu, tạo rỗng làm /public/about lỗi 500).
 * Lấy khóa advisory đầu tiên: hai lần chạy cùng lúc trên database trống không tạo ra bốn tài khoản.
 * Mật khẩu tạm chỉ nằm trong giá trị trả về để CLI in ra một lần.
 */
export async function runBootstrapInTx(tx: Tx, input: BootstrapInput | null, now = new Date()): Promise<BootstrapResult> {
  await lockPrivilegedRoles(tx)
  const privileged = await tx.userRole.findMany({
    where: { role: { in: ['BOARD', 'TECH_ADMIN'] } },
    select: { role: true, status: true, grantedById: true, reason: true, user: { select: { id: true, username: true, status: true } } },
    orderBy: { role: 'asc' },
  })
  const bootstrapRows = privileged.filter((row) => row.grantedById === null && row.reason === BOOTSTRAP_REASON)
  const waiting = bootstrapRows.filter((row) => row.status === 'PENDING' && row.user.status !== 'INACTIVE')

  if (waiting.length > 0) {
    const live = bootstrapRows.filter((row) => row.status === 'PENDING' || row.status === 'ACTIVE')
    const count = (role: 'BOARD' | 'TECH_ADMIN') => live.filter((row) => row.role === role).length
    if (count('BOARD') !== 1 || count('TECH_ADMIN') !== 1) {
      throw new BootstrapRefused(
        'Tài khoản bootstrap không còn đủ đúng một BOARD và một TECH_ADMIN (có dòng đã bị thu hồi hoặc hết hạn). Không cấp lại một phần; xử lý theo runbook mất quyền quản trị.',
      )
    }
    const accounts: BootstrapResult['accounts'] = []
    for (const row of waiting) {
      const { temporaryPassword, expiresAt } = await reissueTemporaryPassword(tx, SERVICE, row.user.id, 'bootstrap: cấp lại mật khẩu tạm', now)
      accounts.push({ role: row.role as 'BOARD' | 'TECH_ADMIN', username: row.user.username, temporaryPassword, expiresAt })
    }
    return { status: 'reissued', accounts, termEndsAtSaved: true }
  }

  if (privileged.length > 0) {
    throw new BootstrapRefused('Đã từng có Ban Chủ nhiệm hoặc quản trị viên kỹ thuật: bootstrap đã hoàn tất, không chạy lại.')
  }

  if (!input) throw new BootstrapRefused('Chưa có tài khoản bootstrap: cần thông tin hai người và ngày kết thúc nhiệm kỳ.')
  const data = bootstrapInputSchema.parse(input)
  const termEndsAt = endOfVnDay(data.termEndsAt)
  if (termEndsAt <= now) throw new BootstrapRefused('Ngày kết thúc nhiệm kỳ phải ở tương lai.')
  const setting = await tx.siteSetting.findFirst({ select: { id: true, termEndsAt: true } })
  if (setting?.termEndsAt && termEndsAt > setting.termEndsAt) {
    throw new BootstrapRefused(
      `Ngày kết thúc nhiệm kỳ nhập vào muộn hơn ngày đã lưu ở Thông tin APC (${setting.termEndsAt.toISOString()} UTC). Vai trò không được sống quá nhiệm kỳ (RP-03).`,
    )
  }

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

  // QĐ-6: một nguồn duy nhất cho ngày kết thúc nhiệm kỳ; chỉ ghi khi dòng đã có và đang trống (docs/02 §11: có audit).
  if (setting && !setting.termEndsAt) {
    await tx.siteSetting.update({ where: { id: setting.id }, data: { termEndsAt } })
    await audit(
      SERVICE,
      {
        action: AUDIT_ACTIONS.ORG_UPDATE_INFO,
        targetType: 'SITE_SETTING',
        targetId: setting.id,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        reason: BOOTSTRAP_REASON,
        metadata: { field: 'termEndsAt', termEndsAt: termEndsAt.toISOString() },
      },
      tx,
    )
  }

  return { status: 'created', accounts, termEndsAtSaved: !!setting }
}

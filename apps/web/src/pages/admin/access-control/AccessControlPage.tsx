import { useState } from 'react'
import { Link } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { ConfirmDialog, type ConfirmValues } from '../../../components/ConfirmDialog'
import { useApi } from '../../../hooks/useApi'
import { useAuth } from '../../../hooks/useAuth'
import { api } from '../../../lib/api'
import { hasRole } from '../../../lib/auth'
import { formatDate, formatDateTime } from '../../../lib/format'
import { ROLE_LABEL, type RoleDecision } from '../accounts/accountTypes'

type Decisions = { pending: RoleDecision[]; recent: RoleDecision[] }

const STATUS = { PENDING: 'Đang chờ', EXECUTED: 'Đã thực hiện', CANCELLED: 'Đã hủy' } as const

const describe = (decision: RoleDecision) =>
  `${decision.action === 'GRANT' ? 'Gán' : 'Thu hồi'} ${ROLE_LABEL[decision.role]} cho ${decision.user?.fullName ?? '—'} (${decision.user?.username ?? ''})`

/**
 * PAGE-MGT-MEM-07 — hàng đợi quyết định gán/thu hồi TECH_ADMIN (DUAL, Vai trò & quyền §8.6).
 * BOARD theo dõi và hủy; một TECH_ADMIN khác đang hoạt động bấm thực hiện.
 */
export function AccessControlPage() {
  const { user } = useAuth()
  const board = hasRole(user, 'BOARD')
  const tech = hasRole(user, 'TECH_ADMIN')
  const decisions = useApi<Decisions>('/admin/access-control')
  const [action, setAction] = useState<{ kind: 'execute' | 'cancel'; decision: RoleDecision } | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function confirm(values: ConfirmValues) {
    if (!action) return
    const url = `/admin/access-control/${action.decision.id}/${action.kind}`
    await api(url, { body: action.kind === 'cancel' ? { reason: values.reason } : {} })
    setDone(action.kind === 'execute' ? 'Đã thực hiện quyết định.' : 'Đã hủy quyết định.')
    setAction(null)
    decisions.reload()
  }

  return (
    <main className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-[-0.03em]">Phân quyền</h1>
        <p className="mt-3 max-w-[64ch] text-[17px] text-muted">
          Gán hoặc thu hồi Quản trị viên kỹ thuật cần hai người: Ban Chủ nhiệm ghi quyết định ở trang vai trò của tài khoản, một quản trị
          viên kỹ thuật khác thực hiện ở đây. Vai trò khác do Ban Chủ nhiệm gán trực tiếp ở trang{' '}
          <Link className="font-bold text-apc-blue underline" to="/admin/accounts">
            Tài khoản
          </Link>
          .
        </p>
      </div>

      {done && (
        <p role="status" className="rounded-xl bg-apc-blue-pale px-4 py-3 text-[15px] font-bold text-apc-blue">
          {done}
        </p>
      )}

      <AsyncState
        loading={decisions.loading}
        error={decisions.error}
        empty={false}
        onRetry={decisions.reload}
      >
        <section aria-labelledby="pending" className="flex flex-col gap-3">
          <h2 id="pending" className="font-display text-[24px] font-extrabold">Đang chờ thực hiện</h2>
          {decisions.data?.pending.length === 0 ? (
            <p className="text-muted">Không có quyết định nào đang chờ.</p>
          ) : (
            <ul className="flex flex-col divide-y-2 divide-ink/10 border-y-2 border-ink">
              {decisions.data?.pending.map((decision) => {
                const own = decision.user?.id === user?.id
                return (
                  <li key={decision.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <span className="min-w-0">
                      <span className="block font-bold">{describe(decision)}</span>
                      <span className="block text-[14px] text-muted">
                        {decision.decidedBy?.fullName} quyết định lúc {formatDateTime(decision.createdAt)}
                        {decision.expiresAt ? ` · hết hạn ${formatDate(decision.expiresAt)}` : ''} · {decision.reason}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {tech && !own && <Button onClick={() => setAction({ kind: 'execute', decision })}>Thực hiện</Button>}
                      {tech && own && <span className="text-[14px] text-muted">Quyết định về chính bạn: cần người khác thực hiện.</span>}
                      {board && (
                        <Button variant="outline" onClick={() => setAction({ kind: 'cancel', decision })}>
                          Hủy quyết định
                        </Button>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent" className="mt-8 flex flex-col gap-3">
          <h2 id="recent" className="font-display text-[24px] font-extrabold">Đã xử lý gần đây</h2>
          {decisions.data?.recent.length === 0 ? (
            <p className="text-muted">Chưa có.</p>
          ) : (
            <ul className="flex flex-col divide-y-2 divide-ink/10 border-y-2 border-ink">
              {decisions.data?.recent.map((decision) => (
                <li key={decision.id} className="py-3 text-[15px]">
                  <span className="font-bold">{describe(decision)}</span>
                  <span className="block text-muted">
                    {STATUS[decision.status]} · quyết định: {decision.decidedBy?.fullName}
                    {decision.executedBy ? ` · thực hiện: ${decision.executedBy.fullName}` : ''}
                    {decision.executedAt ? ` lúc ${formatDateTime(decision.executedAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </AsyncState>

      <ConfirmDialog
        open={!!action}
        title={action?.kind === 'execute' ? 'Thực hiện quyết định?' : 'Hủy quyết định?'}
        description={
          <>
            <strong className="text-ink">{action ? describe(action.decision) : ''}</strong>
            <br />
            {action?.kind === 'execute'
              ? 'Vai trò có hiệu lực (hoặc bị thu hồi) ngay; người nhận bị đăng xuất. Nhật ký ghi cả người quyết định và bạn.'
              : 'Quyết định không còn hiệu lực; muốn làm lại phải ghi quyết định mới.'}
          </>
        }
        confirmLabel={action?.kind === 'execute' ? 'Thực hiện' : 'Hủy quyết định'}
        danger={action?.kind === 'execute'}
        reason={action?.kind === 'execute' ? 'none' : 'required'}
        onConfirm={confirm}
        onClose={() => setAction(null)}
      />
    </main>
  )
}

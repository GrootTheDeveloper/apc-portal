import { type ReactNode, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Button } from '../../../../components/Button'
import { ConfirmDialog, type ConfirmValues } from '../../../../components/ConfirmDialog'
import { useApi } from '../../../../hooks/useApi'
import { useAuth } from '../../../../hooks/useAuth'
import { api } from '../../../../lib/api'
import { hasRole } from '../../../../lib/auth'
import { formatDateTime } from '../../../../lib/format'
import { NotFound } from '../../../NotFound'
import type { AccountDetail } from '../accountTypes'
import { StatusBadge, TemporaryPasswordNotice } from '../shared'

type ActionKey = 'lock' | 'unlock' | 'reset-password' | 'deactivate' | 'revoke-sessions'

type ActionSpec = {
  key: ActionKey
  label: string
  title: string
  effect: string
  danger: boolean
}

// FLOW-11: mỗi hành động nêu rõ ảnh hưởng trong hộp xác nhận (STATE-07).
const ACTIONS: Record<ActionKey, ActionSpec> = {
  lock: {
    key: 'lock',
    label: 'Khóa tài khoản',
    title: 'Khóa tài khoản?',
    effect: 'Người dùng bị đăng xuất ngay trên mọi thiết bị và không đăng nhập được cho đến khi được mở khóa.',
    danger: true,
  },
  unlock: {
    key: 'unlock',
    label: 'Mở khóa',
    title: 'Mở khóa tài khoản?',
    effect: 'Tài khoản hoạt động lại; người dùng phải đăng nhập lại (phiên cũ không được khôi phục).',
    danger: false,
  },
  'reset-password': {
    key: 'reset-password',
    label: 'Cấp lại mật khẩu tạm',
    title: 'Cấp lại mật khẩu tạm?',
    effect: 'Mật khẩu hiện tại hết hiệu lực, mọi phiên bị đăng xuất. Mật khẩu tạm 72 giờ hiện một lần để bạn chuyển cho người dùng.',
    danger: true,
  },
  deactivate: {
    key: 'deactivate',
    label: 'Ngừng hoạt động',
    title: 'Ngừng hoạt động tài khoản?',
    effect: 'Tài khoản không đăng nhập được nữa, mọi phiên bị đăng xuất, mọi vai trò quản lý và đặc quyền bị thu hồi. Hồ sơ lịch sử vẫn được giữ.',
    danger: true,
  },
  'revoke-sessions': {
    key: 'revoke-sessions',
    label: 'Đăng xuất mọi thiết bị',
    title: 'Thu hồi toàn bộ phiên đăng nhập?',
    effect: 'Người dùng bị đăng xuất trên mọi thiết bị; tài khoản vẫn hoạt động và đăng nhập lại được.',
    danger: false,
  },
}

const TABS = [
  { key: 'status', label: 'Trạng thái tài khoản' },
  { key: 'sessions', label: 'Phiên đăng nhập' },
  { key: 'actions', label: 'Hành động bảo mật' },
] as const

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b-2 border-ink/10 py-3 sm:grid-cols-[220px_minmax(0,1fr)]">
      <dt className="font-code text-[13px] font-bold text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

const when = (value?: string | null) => (value ? formatDateTime(value) : '—')

/** PAGE-MGT-MEM-05 — chi tiết tài khoản. BOARD thấy thông tin nghiệp vụ; TECH_ADMIN thấy phiên và trạng thái kỹ thuật. */
export function AccountDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const board = hasRole(user, 'BOARD')
  const tech = hasRole(user, 'TECH_ADMIN')
  const [searchParams, setSearchParams] = useSearchParams()
  const tabs = TABS.filter((tab) => tab.key !== 'sessions' || tech)
  const tab = tabs.find((item) => item.key === searchParams.get('tab'))?.key ?? 'status'
  const account = useApi<AccountDetail>(`/admin/accounts/${encodeURIComponent(id)}`)
  const [action, setAction] = useState<ActionSpec | null>(null)
  const [temporary, setTemporary] = useState<{ password: string; expiresAt: string } | null>(null)
  const [done, setDone] = useState<string | null>(null)

  if (account.error?.status === 404) return <NotFound />
  const data = account.data
  const self = data?.id === user?.id

  // Nút theo vai trò (Vai trò & quyền §8.2) và bước chuyển hợp lệ (PRD §9.2). Không thao tác trên chính mình.
  const available: ActionSpec[] = !data
    ? []
    : [
        ...((board || tech) && !self && ['PENDING_ACTIVATION', 'ACTIVE'].includes(data.status) ? [ACTIONS.lock] : []),
        ...(board && !self && data.status === 'LOCKED' ? [ACTIONS.unlock] : []),
        ...(board && !self && data.status !== 'INACTIVE' ? [ACTIONS['reset-password']] : []),
        ...(board || tech ? [ACTIONS['revoke-sessions']] : []),
        ...(board && !self && data.status !== 'INACTIVE' ? [ACTIONS.deactivate] : []),
      ]

  async function run(spec: ActionSpec, values: ConfirmValues) {
    // Lý do để trống (chỉ có ở thu hồi phiên) thì không gửi; updatedAt đã đọc để server phát hiện sửa chồng (STATE-09).
    const body = { ...values, ...(values.reason ? {} : { reason: undefined }), ...(data ? { updatedAt: data.updatedAt } : {}) }
    if (spec.key === 'reset-password') {
      const result = await api<{ temporaryPassword: string; expiresAt: string }>(`/admin/accounts/${id}/reset-password`, { body })
      setTemporary({ password: result.temporaryPassword, expiresAt: result.expiresAt })
    } else {
      await api(`/admin/accounts/${id}/${spec.key}`, { body })
    }
    setDone(`Đã thực hiện: ${spec.label.toLowerCase()}.`)
    setAction(null)
    account.reload()
  }

  return (
    <main className="flex flex-col gap-8">
      <AsyncState loading={account.loading} error={account.error} empty={false} onRetry={account.reload}>
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="font-display text-[clamp(30px,3.6vw,48px)] font-extrabold leading-none tracking-[-0.03em]">
                {data.fullName}
              </h1>
              <StatusBadge status={data.status} />
            </div>

            <div role="tablist" aria-label="Thông tin tài khoản" className="flex flex-wrap gap-2">
              {tabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  onClick={() => setSearchParams(item.key === 'status' ? {} : { tab: item.key })}
                  className={`inline-flex min-h-10 items-center rounded-full px-4 text-[15px] font-extrabold transition-colors ${
                    tab === item.key ? 'bg-ink text-paper' : 'bg-soft text-ink hover:bg-apc-blue-pale'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {done && (
              <p role="status" className="rounded-xl bg-apc-blue-pale px-4 py-3 text-[15px] font-bold text-apc-blue">
                {done}
              </p>
            )}
            {temporary && <TemporaryPasswordNotice username={data.username} password={temporary.password} expiresAt={temporary.expiresAt} />}

            {tab === 'status' && (
              <dl className="border-t-2 border-ink">
                <Field label="tên đăng nhập">{data.username}</Field>
                {board && <Field label="email tài khoản">{data.email}</Field>}
                {board && <Field label="ban">{data.department?.name ?? 'Chưa thuộc ban'}</Field>}
                <Field label="trạng thái">
                  <StatusBadge status={data.status} />
                </Field>
                <Field label="tạo lúc">{when(data.createdAt)}</Field>
                <Field label="đổi mật khẩu lần cuối">{when(data.passwordChangedAt)}</Field>
                {board && (
                  <Field label="mật khẩu tạm">
                    {data.isTemporaryPassword ? `Đang dùng, hết hạn ${when(data.temporaryPasswordExpiresAt)}` : 'Không'}
                  </Field>
                )}
                {board && data.deactivatedAt && <Field label="ngừng hoạt động lúc">{when(data.deactivatedAt)}</Field>}
                {board && (
                  <Field label="vai trò đang có">
                    {data.roles && data.roles.length > 0
                      ? data.roles
                          .map((role) => `${role.role}${role.department ? ` (${role.department.name})` : ''}${role.status === 'PENDING' ? ' — chờ kích hoạt' : ''}`)
                          .join(', ')
                      : 'Thành viên'}
                  </Field>
                )}
                {tech && (
                  <>
                    <Field label="đăng nhập sai liên tiếp">{data.failedLoginAttempts ?? 0}</Field>
                    <Field label="bị chặn tạm đến">{when(data.lockoutUntil)}</Field>
                  </>
                )}
              </dl>
            )}

            {tab === 'sessions' && tech && (
              <div>
                {data.sessions && data.sessions.length > 0 ? (
                  <ul className="flex flex-col divide-y-2 divide-ink/10 border-y-2 border-ink">
                    {data.sessions.map((session) => (
                      <li key={session.id} className="grid gap-1 py-3 text-[15px]">
                        <span className="font-bold">Hoạt động lần cuối {when(session.lastActiveAt)}</span>
                        <span className="text-muted">
                          Bắt đầu {when(session.createdAt)} · IP {session.ipAddress ?? '—'} · {session.twoFactorVerified ? 'đã qua 2 lớp' : 'chưa qua 2 lớp'}
                        </span>
                        <span className="break-all font-code text-[13px] text-muted">{session.userAgent ?? '—'}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">Không có phiên nào đang mở.</p>
                )}
              </div>
            )}

            {tab === 'actions' && (
              <div className="flex flex-col gap-4">
                {self && <p className="text-muted">Đây là tài khoản của bạn: không tự khóa, mở khóa, cấp mật khẩu hay ngừng hoạt động.</p>}
                {tech && !board && <p className="text-muted">Quản trị viên kỹ thuật chỉ khóa tài khoản khi xử lý sự cố đã ghi nhận, kèm mã sự cố.</p>}
                <div className="flex flex-wrap gap-3">
                  {available.map((spec) => (
                    <Button key={spec.key} variant={spec.danger ? 'primary' : 'outline'} onClick={() => setAction(spec)}>
                      {spec.label}
                    </Button>
                  ))}
                </div>
                {available.length === 0 && <p className="text-muted">Không có hành động nào cho tài khoản ở trạng thái này.</p>}
              </div>
            )}

            <ConfirmDialog
              open={!!action}
              title={action?.title ?? ''}
              description={
                <>
                  <strong className="text-ink">
                    {data.fullName} ({data.username})
                  </strong>
                  <br />
                  {action?.effect}
                </>
              }
              confirmLabel={action?.label ?? 'Xác nhận'}
              danger={action?.danger ?? false}
              reason={action?.key === 'revoke-sessions' ? 'optional' : 'required'}
              {...(action?.key === 'lock' && tech && !board ? { incident: 'required' as const } : {})}
              {...(action?.key === 'lock' && board ? { incident: 'optional' as const } : {})}
              onConfirm={(values) => run(action!, values)}
              onClose={() => setAction(null)}
            />
          </>
        )}
      </AsyncState>
    </main>
  )
}

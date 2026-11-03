import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Button } from '../../../../components/Button'
import { ConfirmDialog, type ConfirmValues } from '../../../../components/ConfirmDialog'
import { inputClass, labelClass } from '../../../../components/formClass'
import { useApi } from '../../../../hooks/useApi'
import { useAuth } from '../../../../hooks/useAuth'
import { api, ApiError } from '../../../../lib/api'
import { hasRole } from '../../../../lib/auth'
import { formatDate, formatDateTime, vnParts } from '../../../../lib/format'
import { fieldErrors } from '../../../../lib/formErrors'
import { type AccountRoles, type ManagedRole, ROLE_LABEL, ROLE_STATUS_LABEL, type RoleRow } from '../accountTypes'

const ROLES = Object.keys(ROLE_LABEL) as ManagedRole[]

/** yyyy-mm-dd theo giờ Việt Nam, dùng cho ô chọn ngày. */
const vnDate = (value: string | Date) => {
  const { year, month, day } = vnParts(value)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
/**
 * Ngày hết hạn gửi lên API: hết ngày đã chọn theo giờ Việt Nam (23:59:59 +07:00), nhưng không muộn hơn
 * `termEndsAt` (RP-03). Chọn đúng ngày kết thúc nhiệm kỳ thì gửi chính `termEndsAt`, API không báo 422.
 */
const expiryFor = (date: string, termEndsAt: string | null) => {
  const endOfDay = new Date(`${date}T23:59:59+07:00`)
  return termEndsAt && endOfDay > new Date(termEndsAt) ? new Date(termEndsAt).toISOString() : endOfDay.toISOString()
}

function ErrorList({ messages }: { messages?: string[] | undefined }) {
  return messages?.map((message) => (
    <span key={message} className="font-body text-[15px] text-apc-red">
      {message}
    </span>
  ))
}

/** Form gán vai trò (BOARD). TECH_ADMIN chỉ tạo quyết định, chờ TECH_ADMIN khác thực hiện. */
function GrantForm({ data, accountId, onDone }: { data: AccountRoles; accountId: string; onDone: (message: string) => void }) {
  const [role, setRole] = useState<ManagedRole>('DEPARTMENT_MANAGER')
  const [departmentId, setDepartmentId] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ message: string; fields: Record<string, string[]> } | null>(null)
  const privileged = role !== 'DEPARTMENT_MANAGER'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const body = {
        role,
        reason,
        ...(privileged ? { expiresAt: expiresOn ? expiryFor(expiresOn, data.termEndsAt) : null } : { departmentId: departmentId || null }),
      }
      const result = await api<{ kind: 'role' | 'decision'; status: string }>(`/admin/accounts/${accountId}/roles`, { body })
      onDone(
        result.kind === 'decision'
          ? 'Đã ghi quyết định gán Quản trị viên kỹ thuật. Quyết định có hiệu lực khi một quản trị viên kỹ thuật khác thực hiện ở trang Phân quyền.'
          : result.status === 'PENDING'
            ? 'Đã gán vai trò ở trạng thái Chờ kích hoạt: người nhận phải thiết lập xác thực hai bước.'
            : 'Đã gán vai trò.',
      )
      setReason('')
    } catch (caught) {
      const message = caught instanceof ApiError && caught.status !== 422 ? caught.message : 'Kiểm tra lại các ô được đánh dấu.'
      setError({ message, fields: fieldErrors(caught) })
    } finally {
      setPending(false)
    }
  }

  const fields = error?.fields ?? {}
  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5 rounded-2xl bg-soft p-5 md:grid-cols-2">
      <h2 className="font-display text-[24px] font-extrabold md:col-span-2">Gán vai trò</h2>
      <label className={labelClass}>
        vai trò
        <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as ManagedRole)} disabled={pending}>
          {ROLES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABEL[value]}
            </option>
          ))}
        </select>
      </label>
      {privileged ? (
        <label className={labelClass}>
          ngày hết hạn
          <input
            type="date"
            className={inputClass}
            value={expiresOn}
            min={vnDate(new Date())}
            {...(data.termEndsAt ? { max: vnDate(data.termEndsAt) } : {})}
            onChange={(event) => setExpiresOn(event.target.value)}
            aria-invalid={!!fields.expiresAt}
            disabled={pending}
          />
          <span className="font-body text-[14px] font-normal text-muted">
            {data.termEndsAt ? `Không muộn hơn ngày kết thúc nhiệm kỳ ${formatDate(data.termEndsAt)}.` : 'Chưa cấu hình ngày kết thúc nhiệm kỳ (trang Thông tin APC).'}
          </span>
          <ErrorList messages={fields.expiresAt} />
        </label>
      ) : (
        <label className={labelClass}>
          ban
          <select className={inputClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} aria-invalid={!!fields.departmentId} disabled={pending}>
            <option value="">Chọn ban</option>
            {data.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <ErrorList messages={fields.departmentId} />
        </label>
      )}
      <label className={`${labelClass} md:col-span-2`}>
        lý do
        <textarea className={`${inputClass} min-h-20`} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} aria-invalid={!!fields.reason} disabled={pending} />
        <ErrorList messages={fields.reason} />
      </label>
      {role === 'TECH_ADMIN' && (
        <p className="text-[15px] text-muted md:col-span-2">
          Gán Quản trị viên kỹ thuật cần hai người: bạn ghi quyết định, một quản trị viên kỹ thuật khác đang hoạt động thực hiện.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-apc-red/10 px-4 py-3 text-[15px] font-bold text-apc-red md:col-span-2">
          {error.message}
        </p>
      )}
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending || !reason.trim()}>
          {pending ? 'Đang lưu…' : role === 'TECH_ADMIN' ? 'Ghi quyết định' : 'Gán vai trò'}
        </Button>
      </div>
    </form>
  )
}

function roleLine(row: RoleRow) {
  return `${ROLE_LABEL[row.role]}${row.department ? ` — ${row.department.name}` : ''}`
}

/** PAGE-MGT-MEM-06 — vai trò, phạm vi, ngày hiệu lực/hết hạn, lý do và lịch sử của một tài khoản. */
export function AccountRolesPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const board = hasRole(user, 'BOARD')
  const roles = useApi<AccountRoles>(`/admin/accounts/${encodeURIComponent(id)}/roles`)
  const [done, setDone] = useState<string | null>(null)
  const [action, setAction] = useState<{ kind: 'revoke' | 'move'; row: RoleRow } | null>(null)
  const [moveTo, setMoveTo] = useState('')

  const data = roles.data
  const self = data?.user.id === user?.id
  const current = data?.roles.filter((row) => row.status === 'PENDING' || row.status === 'ACTIVE') ?? []
  const history = data?.roles.filter((row) => row.status === 'EXPIRED' || row.status === 'REVOKED') ?? []
  const pendingDecisions = data?.decisions.filter((decision) => decision.status === 'PENDING') ?? []

  async function confirm(values: ConfirmValues) {
    if (!action) return
    const base = `/admin/accounts/${id}/roles/${action.row.id}`
    if (action.kind === 'revoke') {
      const result = await api<{ kind: string }>(`${base}/revoke`, { body: { reason: values.reason } })
      setDone(result.kind === 'decision' ? 'Đã ghi quyết định thu hồi. Chờ một quản trị viên kỹ thuật khác thực hiện.' : 'Đã thu hồi vai trò.')
    } else {
      await api(`${base}/change-department`, { body: { departmentId: moveTo, reason: values.reason } })
      setDone('Đã chuyển ban quản lý.')
    }
    setAction(null)
    roles.reload()
  }

  return (
    <main className="flex flex-col gap-8">
      <AsyncState loading={roles.loading} error={roles.error} empty={false} onRetry={roles.reload}>
        {data && (
          <>
            <div>
              <h1 className="font-display text-[clamp(30px,3.6vw,48px)] font-extrabold leading-none tracking-[-0.03em]">Vai trò và phạm vi</h1>
              <p className="mt-3 text-[17px] text-muted">
                <Link className="font-bold text-apc-blue underline" to={`/admin/accounts/${data.user.id}`}>
                  {data.user.fullName} ({data.user.username})
                </Link>{' '}
                · luôn có vai trò nền Thành viên.
              </p>
            </div>

            {done && (
              <p role="status" className="rounded-xl bg-apc-blue-pale px-4 py-3 text-[15px] font-bold text-apc-blue">
                {done}
              </p>
            )}
            {self && <p className="text-muted">Đây là tài khoản của bạn: không ai tự thay đổi vai trò của chính mình.</p>}

            <section aria-labelledby="current-roles" className="flex flex-col gap-3">
              <h2 id="current-roles" className="font-display text-[24px] font-extrabold">Đang có</h2>
              {current.length === 0 ? (
                <p className="text-muted">Chưa có vai trò quản lý hay đặc quyền nào.</p>
              ) : (
                <ul className="flex flex-col divide-y-2 divide-ink/10 border-y-2 border-ink">
                  {current.map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <span className="min-w-0">
                        <span className="block font-bold">{roleLine(row)}</span>
                        <span className="block text-[14px] text-muted">
                          {ROLE_STATUS_LABEL[row.status]} · từ {formatDate(row.startsAt)}
                          {row.expiresAt ? ` đến ${formatDate(row.expiresAt)}` : ''} · {row.reason}
                        </span>
                      </span>
                      {board && !self && (
                        <span className="flex flex-wrap gap-2">
                          {row.role === 'DEPARTMENT_MANAGER' && row.status === 'ACTIVE' && (
                            <Button variant="outline" onClick={() => {
                              setMoveTo('') // mở lại hộp "Đổi ban" không giữ lựa chọn cũ
                              setAction({ kind: 'move', row })
                            }}>
                              Đổi ban
                            </Button>
                          )}
                          <Button onClick={() => setAction({ kind: 'revoke', row })}>Thu hồi</Button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {pendingDecisions.length > 0 && (
              <section aria-labelledby="pending-decisions" className="flex flex-col gap-3">
                <h2 id="pending-decisions" className="font-display text-[24px] font-extrabold">Quyết định đang chờ thực hiện</h2>
                <ul className="flex flex-col gap-2">
                  {pendingDecisions.map((decision) => (
                    <li key={decision.id} className="rounded-xl bg-apc-gold-pale px-4 py-3 text-[15px]">
                      {decision.action === 'GRANT' ? 'Gán' : 'Thu hồi'} {ROLE_LABEL[decision.role]} — {decision.decidedBy?.fullName} quyết định lúc{' '}
                      {formatDateTime(decision.createdAt)}.{' '}
                      <Link className="font-bold underline" to="/admin/access-control">
                        Xem hàng đợi
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {board && !self && data.user.status === 'ACTIVE' && <GrantForm data={data} accountId={data.user.id} onDone={(message) => { setDone(message); roles.reload() }} />}

            <section aria-labelledby="role-history" className="flex flex-col gap-3">
              <h2 id="role-history" className="font-display text-[24px] font-extrabold">Lịch sử</h2>
              {history.length === 0 ? (
                <p className="text-muted">Chưa có vai trò nào hết hạn hoặc bị thu hồi.</p>
              ) : (
                <ul className="flex flex-col divide-y-2 divide-ink/10 border-y-2 border-ink">
                  {history.map((row) => (
                    <li key={row.id} className="py-3 text-[15px]">
                      <span className="font-bold">{roleLine(row)}</span>
                      <span className="block text-muted">
                        {ROLE_STATUS_LABEL[row.status]} · cấp {formatDate(row.startsAt)}
                        {row.grantedBy ? ` bởi ${row.grantedBy.fullName}` : ''}
                        {row.revokedAt ? ` · thu hồi ${formatDate(row.revokedAt)}` : ''}
                        {row.revokedBy ? ` bởi ${row.revokedBy.fullName}` : ''}
                      </span>
                      <span className="block text-muted">
                        Lý do cấp: {row.reason}
                        {row.revokeReason ? ` · lý do thu hồi: ${row.revokeReason}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <ConfirmDialog
              open={!!action}
              title={action?.kind === 'move' ? 'Đổi ban quản lý?' : 'Thu hồi vai trò?'}
              description={
                action?.kind === 'move' ? (
                  <div className="flex flex-col gap-3">
                    <span>
                      Phạm vi ban <strong className="text-ink">{action.row.department?.name}</strong> bị thu hồi và ban mới được cấp cùng lúc.
                    </span>
                    <label className={labelClass}>
                      ban mới
                      <select className={inputClass} value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
                        <option value="">Chọn ban</option>
                        {data.departments
                          .filter((department) => department.id !== action.row.department?.id)
                          .map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                ) : (
                  <>
                    <strong className="text-ink">{action ? roleLine(action.row) : ''}</strong> của {data.user.fullName}.{' '}
                    {action?.row.role === 'TECH_ADMIN'
                      ? 'Thu hồi Quản trị viên kỹ thuật cần một quản trị viên kỹ thuật khác thực hiện.'
                      : 'Người dùng bị đăng xuất để quyền mới có hiệu lực ngay.'}
                  </>
                )
              }
              confirmLabel={action?.kind === 'move' ? 'Đổi ban' : 'Thu hồi'}
              danger={action?.kind === 'revoke'}
              onConfirm={confirm}
              onClose={() => setAction(null)}
            />
          </>
        )}
      </AsyncState>
    </main>
  )
}

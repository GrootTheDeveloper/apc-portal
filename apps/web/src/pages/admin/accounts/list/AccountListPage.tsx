import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Button } from '../../../../components/Button'
import { inputClass, labelClass } from '../../../../components/formClass'
import { Pagination } from '../../../../components/Pagination'
import { useApi } from '../../../../hooks/useApi'
import { useAuth } from '../../../../hooks/useAuth'
import { api, ApiError, type Page } from '../../../../lib/api'
import { type AccountStatus, hasRole } from '../../../../lib/auth'
import { formatDateTime } from '../../../../lib/format'
import { fieldErrors } from '../../../../lib/formErrors'
import { type AccountLocationState, type AccountRow, STATUS_LABEL } from '../accountTypes'
import { StatusBadge } from '../shared'

const PAGE_SIZE = 20
const STATUSES = Object.keys(STATUS_LABEL) as AccountStatus[]

type Created = { user: { id: string; username: string }; temporaryPassword: string }

/** Form tạo tài khoản (BOARD): tên đăng nhập, email, họ tên, ban. Xong thì sang trang chi tiết, hiện mật khẩu tạm một lần. */
function CreateAccountForm({ onCreated, onCancel }: { onCreated: (created: Created) => void; onCancel: () => void }) {
  const departments = useApi<{ id: string; name: string }[]>('/admin/accounts/departments')
  const [form, setForm] = useState({ username: '', email: '', fullName: '', departmentId: '' })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ message: string; fields: Record<string, string[]> } | null>(null)
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      onCreated(await api<Created>('/admin/accounts', { body: { ...form, departmentId: form.departmentId || null } }))
    } catch (caught) {
      const message =
        caught instanceof ApiError && caught.status === 409
          ? 'Tên đăng nhập hoặc email đã có người dùng.'
          : caught instanceof ApiError && caught.status !== 422
            ? caught.message
            : 'Kiểm tra lại các ô được đánh dấu.'
      setError({ message, fields: fieldErrors(caught) })
    } finally {
      setPending(false)
    }
  }

  const fields = error?.fields ?? {}
  const text = (key: 'username' | 'email' | 'fullName', label: string, type = 'text') => (
    <label className={labelClass}>
      {label}
      <input
        className={inputClass}
        type={type}
        value={form[key]}
        onChange={(event) => set(key)(event.target.value)}
        aria-invalid={!!fields[key]}
        disabled={pending}
        required
      />
      {fields[key]?.map((message) => (
        <span key={message} className="font-body text-[15px] text-apc-red">
          {message}
        </span>
      ))}
    </label>
  )

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5 rounded-2xl bg-soft p-5 md:grid-cols-2">
      <h2 className="font-display text-[24px] font-extrabold md:col-span-2">Tạo tài khoản</h2>
      {text('username', 'tên đăng nhập')}
      {text('email', 'email tài khoản', 'email')}
      {text('fullName', 'họ tên')}
      <label className={labelClass}>
        ban
        <select
          className={inputClass}
          value={form.departmentId}
          onChange={(event) => set('departmentId')(event.target.value)}
          aria-invalid={!!fields.departmentId}
          disabled={pending || departments.loading}
        >
          <option value="">Chưa thuộc ban</option>
          {departments.data?.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        {fields.departmentId?.map((message) => (
          <span key={message} className="font-body text-[15px] text-apc-red">
            {message}
          </span>
        ))}
      </label>
      <p className="text-[15px] text-muted md:col-span-2">
        Tài khoản mới ở trạng thái Chờ kích hoạt, chỉ có vai trò Thành viên. Hệ thống sinh mật khẩu tạm 72 giờ.
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-apc-red/10 px-4 py-3 text-[15px] font-bold text-apc-red md:col-span-2">
          {error.message}
        </p>
      )}
      <div className="flex flex-wrap gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang tạo…' : 'Tạo tài khoản'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Hủy
        </Button>
      </div>
    </form>
  )
}

/** PAGE-MGT-MEM-04 — danh sách tài khoản: tìm theo tên, lọc trạng thái, phân trang; bộ lọc lưu trên URL. */
export function AccountListPage() {
  const { user } = useAuth()
  const board = hasRole(user, 'BOARD')
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const [draft, setDraft] = useState(q)
  const [creating, setCreating] = useState(false)

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (q) query.set('q', q)
  if (status) query.set('status', status)
  const accounts = useApi<Page<AccountRow>>(`/admin/accounts?${query}`)

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    setSearchParams(next)
  }
  const filtered = !!q || !!status
  const totalPages = Math.ceil((accounts.data?.total ?? 0) / PAGE_SIZE)

  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-[-0.03em]">Tài khoản</h1>
          <p className="mt-3 text-[17px] text-muted">
            {board ? 'Tạo, khóa, mở khóa, cấp lại mật khẩu tạm và ngừng hoạt động tài khoản.' : 'Trạng thái kỹ thuật: phiên đăng nhập và lần đăng nhập sai.'}
          </p>
        </div>
        {board && !creating && <Button onClick={() => setCreating(true)}>+ Tạo tài khoản</Button>}
      </div>

      {creating && (
        <CreateAccountForm
          onCancel={() => setCreating(false)}
          onCreated={(result) => {
            // Sitemap §15.3: tạo xong sang trang chi tiết; mật khẩu tạm đi kèm state để hiện một lần ở đó.
            const state: AccountLocationState = {
              listSearch: location.search,
              created: { username: result.user.username, temporaryPassword: result.temporaryPassword },
            }
            navigate(`/admin/accounts/${result.user.id}`, { state })
          }}
        />
      )}

      <form
        role="search"
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          update({ q: draft.trim() })
        }}
      >
        <label className="sr-only" htmlFor="account-q">
          Tìm theo tên
        </label>
        <input id="account-q" className={inputClass} placeholder="Tìm tên đăng nhập, họ tên…" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <label className="sr-only" htmlFor="account-status">
          Trạng thái
        </label>
        <select id="account-status" className={inputClass} value={status} onChange={(event) => update({ status: event.target.value })}>
          <option value="">Mọi trạng thái</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Tìm
        </Button>
      </form>

      <AsyncState
        loading={accounts.loading}
        error={accounts.error}
        empty={accounts.data?.items.length === 0}
        emptyText={filtered ? 'Không có tài khoản khớp bộ lọc.' : 'Chưa có tài khoản nào.'}
        onRetry={accounts.reload}
      >
        <ul className="flex flex-col divide-y-2 divide-ink/10 border-y-2 border-ink">
          {accounts.data?.items.map((account) => (
            <li key={account.id}>
              <Link
                to={`/admin/accounts/${account.id}`}
                state={{ listSearch: location.search } satisfies AccountLocationState}
                className="grid gap-2 py-4 transition-colors hover:bg-soft sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold">{account.fullName}</span>
                  <span className="block truncate font-code text-[14px] text-muted">
                    {account.username}
                    {board && account.email ? ` · ${account.email}` : ''}
                    {board ? ` · ${account.department?.name ?? 'Chưa thuộc ban'}` : ''}
                  </span>
                  {!board && (
                    <span className="block text-[14px] text-muted">
                      {account.activeSessions ?? 0} phiên đang mở · {account.failedLoginAttempts ?? 0} lần sai
                      {account.lockoutUntil && new Date(account.lockoutUntil) > new Date()
                        ? ` · chặn đến ${formatDateTime(account.lockoutUntil)}`
                        : ''}
                    </span>
                  )}
                </span>
                <StatusBadge status={account.status} />
              </Link>
            </li>
          ))}
        </ul>
      </AsyncState>
      {filtered && accounts.data?.items.length === 0 && (
        <div>
          <Button
            variant="outline"
            onClick={() => {
              setDraft('')
              setSearchParams(new URLSearchParams())
            }}
          >
            Xóa bộ lọc
          </Button>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={(next) => update({ page: String(next) })} />
    </main>
  )
}

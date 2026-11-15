import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { Button } from '../../../components/Button'
import { inputClass } from '../../../components/formClass'
import { Pagination } from '../../../components/Pagination'
import { Seo } from '../../../components/Seo'
import { useApi } from '../../../hooks/useApi'
import { useAuth } from '../../../hooks/useAuth'
import { type Page } from '../../../lib/api'
import { hasAnyRole } from '../../../lib/auth'
import { formatDateTime, fromVnDatetimeInput } from '../../../lib/format'
import { IncidentGate } from './IncidentGate'
import { StatusBadge } from './StatusBadge'
import { type DeliveryItem, type IncidentAccess, STATUS_LABEL, STATUSES, TYPE_LABEL, typeLabel, VIEWER_ROLES } from './types'

const PAGE_SIZE = 20
const SELECT = `${inputClass} w-auto py-2 text-[15px]`

/**
 * Theo dõi email giao dịch (O3, NTF-04). Trưởng ban: ban mình; BOARD: tất cả; TECH_ADMIN: chỉ metadata, sau khi
 * nhập mã sự cố + lý do (gửi bằng POST, không đặt trên URL). Bộ lọc và trang lưu trên URL.
 */
export function AdminEmailDeliveriesListPage() {
  const { user } = useAuth()
  const incidentMode = !hasAnyRole(user, VIEWER_ROLES)
  const [params, setParams] = useSearchParams()
  const [access, setAccess] = useState<IncidentAccess | null>(null)
  const page = Math.max(1, Number(params.get('page')) || 1)
  const status = params.get('status') ?? ''
  const type = params.get('type') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const filtered = !!(status || type || from || to)

  const filters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(from ? { from: fromVnDatetimeInput(`${from}T00:00`) } : {}),
      ...(to ? { to: fromVnDatetimeInput(`${to}T23:59`) } : {}),
    }),
    [page, status, type, from, to],
  )
  const options = useMemo(
    () => (incidentMode && access ? { method: 'POST' as const, body: { ...filters, ...access } } : undefined),
    [incidentMode, access, filters],
  )
  const path = incidentMode ? (access ? '/admin/email-deliveries/search' : null) : `/admin/email-deliveries?${new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]))}`
  const deliveries = useApi<Page<DeliveryItem>>(path, options)
  const items = deliveries.data?.items ?? []

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  // 422 từ quyền INCIDENT: sai dạng mã hoặc thiếu lý do → quay lại form, giữ thông báo.
  const incidentError = incidentMode && access && deliveries.error?.status === 422 ? deliveries.error.message : undefined

  return (
    <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
      <Seo title="Email giao dịch" description="Theo dõi trạng thái gửi email của hệ thống APC." path="/admin/email-deliveries" robots="noindex, nofollow" />
      <Breadcrumb items={[{ label: 'quản trị', to: '/admin' }, { label: 'email giao dịch' }]} />
      <div className="mt-4 border-b-2 border-ink pb-6">
        <p className="font-code text-xs font-bold uppercase text-apc-blue">theo dõi gửi email</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-ink md:text-4xl">Email giao dịch</h1>
      </div>

      {incidentMode && (!access || incidentError) ? (
        <IncidentGate onSubmit={setAccess} {...(incidentError ? { error: incidentError } : {})} />
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 font-code text-xs font-bold uppercase">
              Trạng thái
              <select className={SELECT} value={status} onChange={(event) => update('status', event.target.value)}>
                <option value="">Tất cả</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>{STATUS_LABEL[value]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-code text-xs font-bold uppercase">
              Loại email
              <select className={SELECT} value={type} onChange={(event) => update('type', event.target.value)}>
                <option value="">Tất cả</option>
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-code text-xs font-bold uppercase">
              Từ ngày
              <input type="date" className={SELECT} value={from} max={to || undefined} onChange={(event) => update('from', event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 font-code text-xs font-bold uppercase">
              Đến ngày
              <input type="date" className={SELECT} value={to} min={from || undefined} onChange={(event) => update('to', event.target.value)} />
            </label>
            {filtered && <Button type="button" variant="outline" onClick={() => setParams(new URLSearchParams())}>Xóa bộ lọc</Button>}
          </div>

          <div className="mt-8">
            <AsyncState
              loading={deliveries.loading}
              error={deliveries.error}
              empty={items.length === 0}
              emptyText={filtered ? 'Không có email nào khớp bộ lọc.' : 'Chưa có email nào được gửi.'}
              emptyAction={filtered ? <Button type="button" variant="outline" onClick={() => setParams(new URLSearchParams())}>Xóa bộ lọc</Button> : undefined}
              onRetry={deliveries.reload}
            >
              <div className="grid gap-1">
                {items.map((item) => (
                  <article key={item.id} data-rv className="border-b-2 border-ink/20 py-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="font-code text-xs font-bold uppercase text-apc-blue">{item.department?.name ?? 'Toàn câu lạc bộ'}</p>
                        <h2 className="mt-1 font-display text-xl font-extrabold">
                          <Link
                            className="hover:text-apc-red"
                            to={{ pathname: `/admin/email-deliveries/${item.id}`, search: params.toString() }}
                            state={access ? { access } : undefined}
                          >
                            {typeLabel(item.type)}
                          </Link>
                        </h2>
                        {item.recipient && <p className="mt-1 break-all text-sm text-muted">{item.recipient}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        <StatusBadge status={item.status} />
                        <span className="font-code text-xs text-muted">{item.attempts} lần thử</span>
                        <span className="font-code text-xs text-muted">{formatDateTime(item.createdAt)}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {deliveries.data && deliveries.data.total > deliveries.data.pageSize && (
                <div className="mt-8 flex justify-center">
                  <Pagination currentPage={page} totalPages={Math.ceil(deliveries.data.total / deliveries.data.pageSize)} onPageChange={(next) => update('page', String(next))} />
                </div>
              )}
            </AsyncState>
          </div>
        </>
      )}
    </main>
  )
}

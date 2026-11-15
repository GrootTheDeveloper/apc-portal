import { useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Seo } from '../../../components/Seo'
import { useApi } from '../../../hooks/useApi'
import { useAuth } from '../../../hooks/useAuth'
import { api } from '../../../lib/api'
import { hasAnyRole, hasRole } from '../../../lib/auth'
import { formatDateTime } from '../../../lib/format'
import { IncidentGate } from './IncidentGate'
import { StatusBadge } from './StatusBadge'
import { type DeliveryItem, type IncidentAccess, typeLabel, VIEWER_ROLES } from './types'

/**
 * Chi tiết một lượt gửi email (O3). Chỉ BOARD và TECH_ADMIN (kèm mã sự cố) gửi lại được, và chỉ khi email đang Gửi lỗi.
 * TECH_ADMIN mở từ danh sách thì mang theo mã sự cố qua `location.state`; mở thẳng link thì phải nhập lại.
 */
export function AdminEmailDeliveryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { user } = useAuth()
  const incidentMode = !hasAnyRole(user, VIEWER_ROLES)
  const canRetry = hasRole(user, 'BOARD') || hasRole(user, 'TECH_ADMIN')
  const [access, setAccess] = useState<IncidentAccess | null>((location.state as { access?: IncidentAccess } | null)?.access ?? null)
  const [retrying, setRetrying] = useState(false)

  const options = useMemo(
    () => (incidentMode && access ? { method: 'POST' as const, body: access } : undefined),
    [incidentMode, access],
  )
  const path = !id || (incidentMode && !access) ? null : incidentMode ? `/admin/email-deliveries/${id}/metadata` : `/admin/email-deliveries/${id}`
  const delivery = useApi<DeliveryItem>(path, options)
  const item = delivery.data
  const incidentError = incidentMode && access && delivery.error?.status === 422 ? delivery.error.message : undefined

  async function retry(values: { reason: string; incidentId?: string }) {
    await api(`/admin/email-deliveries/${id}/retry`, { method: 'POST', body: values })
    setRetrying(false)
    delivery.reload()
  }

  const rows: [string, string | undefined][] = item
    ? [
        ['Người nhận', item.recipient],
        ['Ban liên quan', item.department?.name ?? 'Toàn câu lạc bộ'],
        ['Số lần thử', String(item.attempts)],
        ['Tạo lúc', formatDateTime(item.createdAt)],
        ['Cập nhật lúc', formatDateTime(item.updatedAt)],
        ...(item.status === 'PENDING' || item.status === 'RETRY' ? [['Lần thử kế tiếp', formatDateTime(item.nextAttemptAt)] as [string, string]] : []),
      ]
    : []

  return (
    <main className="mx-auto max-w-4xl px-gutter py-10 md:py-14">
      <Breadcrumb
        items={[
          { label: 'quản trị', to: '/admin' },
          { label: 'email giao dịch', to: `/admin/email-deliveries${location.search}` },
          { label: 'chi tiết' },
        ]}
      />
      {incidentMode && (!access || incidentError) ? (
        <IncidentGate onSubmit={setAccess} {...(incidentError ? { error: incidentError } : {})} />
      ) : (
        <div className="mt-6">
          <AsyncState loading={delivery.loading} error={delivery.error} empty={!item} emptyText="Không tìm thấy email." onRetry={delivery.reload}>
            {item && (
              <>
                <Seo title="Chi tiết email" description="Trạng thái gửi một email của hệ thống APC." path={`/admin/email-deliveries/${item.id}`} robots="noindex, nofollow" />
                <div className="flex flex-col justify-between gap-5 border-b-2 border-ink pb-6 sm:flex-row sm:items-end">
                  <div>
                    <p className="font-code text-xs font-bold uppercase text-apc-blue">email giao dịch</p>
                    <h1 className="mt-2 font-display text-3xl font-extrabold text-ink md:text-4xl">{typeLabel(item.type)}</h1>
                    <div className="mt-3">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  {canRetry && item.status === 'FAILED' && (
                    <Button type="button" onClick={() => setRetrying(true)}>
                      Gửi lại
                    </Button>
                  )}
                </div>
                <dl data-rv className="mt-7 grid gap-x-8 gap-y-4 sm:grid-cols-[200px_1fr]">
                  {rows.map(([label, value]) =>
                    value === undefined ? null : (
                      <div key={label} className="contents">
                        <dt className="font-code text-xs font-bold uppercase text-muted">{label}</dt>
                        <dd className="break-all text-[17px]">{value}</dd>
                      </div>
                    ),
                  )}
                </dl>
                {item.lastError && (
                  <section data-rv className="mt-7 rounded-2xl bg-apc-red/10 p-5">
                    <h2 className="font-code text-xs font-bold uppercase text-apc-red">Lỗi gần nhất</h2>
                    <p className="mt-2 break-words font-code text-[15px]">{item.lastError}</p>
                  </section>
                )}
                <ConfirmDialog
                  open={retrying}
                  title="Gửi lại email"
                  description={`Email "${typeLabel(item.type)}" đã gửi lỗi ${item.attempts} lần sẽ quay về trạng thái Chờ gửi, số lần thử được đặt lại và hệ thống sẽ thử gửi lại ngay. Thao tác được ghi nhật ký.`}
                  confirmLabel="Gửi lại"
                  reason={hasRole(user, 'BOARD') ? 'optional' : 'required'}
                  incident={hasRole(user, 'BOARD') ? 'optional' : 'required'}
                  onConfirm={retry}
                  onClose={() => setRetrying(false)}
                  onReload={() => {
                    setRetrying(false)
                    delivery.reload()
                  }}
                />
              </>
            )}
          </AsyncState>
        </div>
      )}
    </main>
  )
}

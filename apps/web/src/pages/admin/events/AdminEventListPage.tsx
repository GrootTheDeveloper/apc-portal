import { Link, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { buttonClass } from '../../../components/buttonClass'
import { Eyebrow } from '../../../components/Eyebrow'
import { Pagination } from '../../../components/Pagination'
import { useApi } from '../../../hooks/useApi'
import type { Page } from '../../../lib/api'
import { formatDateTime } from '../../../lib/format'
import { inputClass, labelClass } from '../../../components/formClass'
import {
  ADMIN_EVENT_STATUS_LABELS,
  AUDIENCE_LABELS,
  type AdminEvent,
  type AdminEventStatus,
  type EventAudience,
} from './types'

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: AdminEventStatus | ''; label: string }[] = [
  { value: '', label: 'Mọi trạng thái' },
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: 'PUBLISHED', label: 'Đang công bố' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'ENDED', label: 'Đã kết thúc' },
  { value: 'ARCHIVED', label: 'Lưu trữ' },
]

const AUDIENCE_OPTIONS: { value: EventAudience | ''; label: string }[] = [
  { value: '', label: 'Mọi đối tượng' },
  { value: 'PUBLIC', label: 'Công khai' },
  { value: 'CLUB', label: 'Toàn CLB' },
  { value: 'DEPARTMENT', label: 'Nội bộ ban' },
]

type AboutData = {
  departments: { id: string; name: string }[]
}

/** PAGE-ADM-EVT-01 — danh sách sự kiện cho quản trị (E4): lọc trạng thái, ban, đối tượng; phân trang.
 * BOARD thấy toàn CLB, quản lý ban chỉ thấy ban mình (API tự thu hẹp phạm vi, docs/02 mục 12.2). */
export function AdminEventListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const status = searchParams.get('status') ?? ''
  const audience = searchParams.get('audience') ?? ''
  const departmentId = searchParams.get('departmentId') ?? ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (status) query.set('status', status)
  if (audience) query.set('audience', audience)
  if (departmentId) query.set('departmentId', departmentId)
  const { data, loading, error, reload } = useApi<Page<AdminEvent>>(`/admin/events?${query}`)

  // Danh sách ban cho bộ lọc — nguồn công khai như trang tạo đợt tuyển.
  const { data: aboutData } = useApi<AboutData>('/public/about')
  const departments = aboutData?.departments ?? []

  function handleFilterChange(key: 'status' | 'audience' | 'departmentId', value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.set('page', '1')
    setSearchParams(next)
  }

  function handlePageChange(newPage: number) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(newPage))
    setSearchParams(next)
  }

  const events = data?.items ?? []
  const filtered = !!status || !!audience || !!departmentId

  return (
    <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
      <Breadcrumb
        items={[
          { label: 'quản trị', to: '/admin' },
          { label: 'sự kiện' },
        ]}
      />

      <div className="mt-4 flex flex-col justify-between gap-4 border-b-2 border-ink pb-6 sm:flex-row sm:items-center">
        <div>
          <Eyebrow className="text-apc-blue">quản lý sự kiện</Eyebrow>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-ink md:text-4xl">Sự kiện của CLB</h1>
        </div>

        {/* API cho phép cả quản lý ban lẫn BOARD tạo sự kiện (E4), nên không chặn nút theo vai trò. */}
        <Link to="/admin/events/new" className={buttonClass('primary')}>
          + Tạo sự kiện
        </Link>
      </div>

      {/* Bộ lọc: đúng 3 ô — Trạng thái, Ban quản lý, Đối tượng; giá trị lưu trên URL để chia sẻ được. */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          Trạng thái
          <select
            className={inputClass}
            value={status}
            onChange={(event) => handleFilterChange('status', event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Ban quản lý
          <select
            className={inputClass}
            value={departmentId}
            onChange={(event) => handleFilterChange('departmentId', event.target.value)}
          >
            <option value="">Mọi ban</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Đối tượng
          <select
            className={inputClass}
            value={audience}
            onChange={(event) => handleFilterChange('audience', event.target.value)}
          >
            {AUDIENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-8">
        <AsyncState
          loading={loading}
          error={error}
          empty={events.length === 0}
          emptyText={filtered ? 'Chưa có sự kiện nào phù hợp với bộ lọc.' : 'Chưa có sự kiện nào. Tạo sự kiện đầu tiên nhé.'}
          onRetry={reload}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left font-body text-sm text-ink">
              <thead>
                <tr className="border-b-2 border-ink font-display text-sm font-bold text-ink">
                  <th className="py-3 pr-4">Sự kiện</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Đối tượng</th>
                  <th className="px-4 py-3">Ban quản lý</th>
                  <th className="px-4 py-3">Thời gian diễn ra</th>
                  <th className="px-4 py-3 text-right">Đăng ký</th>
                  <th className="py-3 pl-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y border-b border-ink/20">
                {events.map((event) => {
                  const badge = ADMIN_EVENT_STATUS_LABELS[event.status]
                  return (
                    <tr key={event.id} className="transition hover:bg-soft">
                      <td className="py-4 pr-4">
                        <Link
                          to={`/admin/events/${event.id}`}
                          className="font-display font-extrabold text-ink transition hover:text-apc-red"
                        >
                          {event.title}
                        </Link>
                        <p className="font-code text-xs text-muted">/{event.slug} · {event.eventType}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-block rounded-md px-2.5 py-1 font-code text-xs ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">{AUDIENCE_LABELS[event.audience]}</td>
                      <td className="px-4 py-4">
                        {event.department ? (
                          <span className="rounded bg-soft px-2 py-0.5 text-xs font-semibold text-ink">
                            {event.department.name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">Toàn CLB</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted">
                        <div>Từ: {formatDateTime(event.startAt)}</div>
                        <div>Đến: {formatDateTime(event.endAt)}</div>
                      </td>
                      <td className="px-4 py-4 text-right font-display font-bold text-ink">
                        {event.registeredCount}
                        {event.capacity !== null && <span className="text-xs font-normal text-muted"> / {event.capacity}</span>}
                      </td>
                      <td className="py-4 pl-4 text-right">
                        <Link to={`/admin/events/${event.id}`} className="font-bold text-apc-blue hover:underline">
                          Chi tiết →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {data && data.total > PAGE_SIZE && (
            <div className="mt-8 flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(data.total / PAGE_SIZE)}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </AsyncState>
      </div>
    </main>
  )
}

import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Breadcrumb } from '../../../../components/Breadcrumb'
import { buttonClass, pillClass } from '../../../../components/buttonClass'
import { ExportStatus, type ExportStatusValue } from '../../../../components/ExportStatus'
import { inputClass } from '../../../../components/formClass'
import { PageHero } from '../../../../components/PageHero'
import { Pagination } from '../../../../components/Pagination'
import { useApi } from '../../../../hooks/useApi'
import { api, ApiError } from '../../../../lib/api'
import { formatDateTime } from '../../../../lib/format'
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_STYLES,
} from '../attendanceState'
import type {
  AdminEvent,
  EventRegistrationItem,
  EventRegistrationStatus,
  ExportCreated,
  RegistrationSearchResult,
} from '../types'

/** Nhãn + màu trạng thái đăng ký (REGISTERED/CANCELLED — EVT-13, khác nhóm điểm danh). */
const REGISTRATION_STATUS: Record<EventRegistrationStatus, { label: string; badgeClass: string }> = {
  REGISTERED: { label: 'Đã đăng ký', badgeClass: 'bg-soft text-ink font-bold' },
  CANCELLED: { label: 'Đã hủy', badgeClass: 'bg-apc-red-pale text-apc-red' },
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'REGISTERED', label: 'Đã đăng ký' },
  { value: 'CANCELLED', label: 'Đã hủy' },
]

/**
 * PAGE-ADM-EVT-05 — danh sách đăng ký của một sự kiện (E6, FLOW-16 bước 1-2, EVT-06).
 * Tìm theo tên/email và lọc trạng thái lưu trên URL (?search=&status=&page=) để chia sẻ được liên kết;
 * ô tìm kiếm gửi qua body POST (OPS-11 — email không đặt trên URL query). "Xuất CSV" gọi
 * POST .../registrations/export (createExport của D6): file chỉ người tạo tải được, tự kích hoạt tải
 * qua route tải bảo vệ /api/portal/exports/:id/download và hiện khối ExportStatus (STATE-06).
 */
export function AdminEventRegistrationsPage() {
  const { id } = useParams<{ id: string }>()

  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') || '1')
  const statusParam = searchParams.get('status') || 'ALL'
  const searchParam = searchParams.get('search') || ''

  const [searchInput, setSearchInput] = useState(searchParam)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportResult, setExportResult] = useState<ExportCreated | null>(null)

  // Tiêu đề + số đăng ký còn hiệu lực cho đầu trang; 404 (sai id hoặc ngoài ban) AsyncState tự hiện.
  const { data: event, loading: loadingEvent, error: eventError, reload: reloadEvent } = useApi<AdminEvent>(
    id ? `/admin/events/${id}` : null,
  )

  // Tìm kiếm gửi qua body POST (OPS-11): tên/email không nằm trên URL.
  const searchOptions = useMemo(
    () => ({
      method: 'POST' as const,
      body: {
        page,
        pageSize: 20,
        status: statusParam !== 'ALL' ? statusParam : undefined,
        search: searchParam || undefined,
      },
    }),
    [page, statusParam, searchParam],
  )
  const {
    data,
    loading,
    error,
    reload,
  } = useApi<RegistrationSearchResult>(id ? `/admin/events/${id}/registrations/search` : null, searchOptions)

  function updateQuery(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || value === 'ALL') next.delete(key)
      else next.set(key, value)
    }
    next.set('page', '1')
    setSearchParams(next)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateQuery({ search: searchInput.trim() })
  }

  async function handleExportCsv() {
    if (!id) return
    setExporting(true)
    setExportError(null)
    try {
      // Gửi đúng bộ lọc đang bật trên màn hình: file xuất khớp danh sách đang xem (FLOW-16 bước 2).
      const result = await api<ExportCreated>(`/admin/events/${id}/registrations/export`, {
        method: 'POST',
        body: {
          status: statusParam !== 'ALL' ? statusParam : undefined,
          search: searchParam || undefined,
        },
      })
      setExportResult(result)
      // Tự kích hoạt tải qua route tải bảo vệ D6 (RP-17) — giống danh sách hồ sơ ứng tuyển.
      const a = document.createElement('a')
      a.href = `/api/portal/exports/${encodeURIComponent(result.id)}/download`
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Không thể xuất file CSV. Vui lòng thử lại.')
    } finally {
      setExporting(false)
    }
  }

  const registrations = data?.items ?? []

  return (
    <div>
      <PageHero
        tone="blue"
        comment="quản trị / sự kiện / danh sách đăng ký"
        title="Danh sách đăng ký"
        lede={event ? event.title : 'Đang tải sự kiện...'}
        top={
          <Breadcrumb
            items={[
              { label: 'quản trị', to: '/admin' },
              { label: 'sự kiện', to: '/admin/events' },
              { label: event?.title ?? 'sự kiện', to: id ? `/admin/events/${id}` : '/admin/events' },
              { label: 'danh sách đăng ký' },
            ]}
          />
        }
        aside={
          <div className="flex flex-wrap items-center gap-3">
            {id && (
              <Link to={`/admin/events/${id}`} className={buttonClass('outline')}>
                &larr; Chi tiết sự kiện
              </Link>
            )}
            <Link to={id ? `/admin/events/${id}/attendance` : '#'} className={buttonClass('outline')}>
              Điểm danh &rarr;
            </Link>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || loading}
              className={buttonClass('light')}
            >
              {exporting ? 'Đang xuất CSV...' : 'Xuất CSV'}
            </button>
          </div>
        }
      />

      <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
        {exportError && (
          <div role="alert" className="mb-6 rounded-xl bg-apc-red-pale p-4 font-bold text-apc-red">
            {exportError}
          </div>
        )}

        {exportResult && (
          <div className="mb-6">
            <ExportStatus
              id={exportResult.id}
              status={exportResult.status as ExportStatusValue}
              filename={exportResult.filename}
              expiresAt={exportResult.expiresAt}
            />
          </div>
        )}

        {/* Bộ lọc — khối bg-soft, không viền (DESIGN.md) */}
        <div className="rounded-[20px] bg-soft p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-code text-xs font-bold uppercase text-muted">Trạng thái:</span>
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => updateQuery({ status: tab.value })}
                  className={pillClass(statusParam === tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Tìm họ tên, email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className={`${inputClass} w-64 text-sm`}
                aria-label="Tìm đăng ký theo họ tên hoặc email"
              />
              <button type="submit" className={buttonClass('outline')}>
                Tìm
              </button>
              {searchParam && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('')
                    updateQuery({ search: null })
                  }}
                  className="text-xs font-bold text-muted hover:text-ink hover:underline"
                >
                  Xóa tìm
                </button>
              )}
            </form>
          </div>
          {event && (
            <p className="mt-4 text-sm text-muted">
              Hiện có <b>{event.registeredCount}</b> đăng ký còn hiệu lực
              {event.attendanceFinalizedAt && <> · điểm danh đã chốt</>}.
            </p>
          )}
        </div>

        <div className="mt-8">
          <AsyncState
            loading={loading || loadingEvent}
            error={error ?? eventError}
            empty={registrations.length === 0}
            emptyText="Không có đăng ký nào phù hợp với bộ lọc."
            onRetry={() => {
              reload()
              reloadEvent()
            }}
          >
            <div className="overflow-x-auto rounded-[20px] border-2 border-ink bg-paper">
              <table className="w-full text-left text-sm text-ink">
                <thead className="border-b-2 border-ink bg-soft font-code text-xs font-bold uppercase text-muted">
                  <tr>
                    <th className="px-6 py-4">Người đăng ký</th>
                    <th className="px-6 py-4">Loại</th>
                    <th className="px-6 py-4">Đăng ký</th>
                    <th className="px-6 py-4">Điểm danh</th>
                    <th className="px-6 py-4">Thời gian đăng ký</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {registrations.map((item: EventRegistrationItem) => {
                    const statusInfo = REGISTRATION_STATUS[item.status]
                    return (
                      <tr key={item.id} data-rv className="transition-colors hover:bg-soft/60">
                        <td className="px-6 py-4">
                          <div className="font-bold text-ink">{item.fullName ?? '—'}</div>
                          <div className="text-xs text-muted">{item.email ?? '—'}</div>
                          {item.studentId && <div className="font-mono text-xs text-muted">MSSV: {item.studentId}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block rounded-md bg-soft px-2.5 py-1 text-xs font-bold text-ink">
                            {item.attendeeType === 'MEMBER' ? 'Thành viên' : 'Khách'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block rounded-full px-3 py-1 text-xs ${statusInfo.badgeClass}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs ${ATTENDANCE_STYLES[item.attendanceStatus]}`}
                          >
                            {ATTENDANCE_LABELS[item.attendanceStatus]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted">
                          {formatDateTime(item.registeredAt)}
                          {item.cancelledAt && <div>Đã hủy: {formatDateTime(item.cancelledAt)}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {data && data.total > data.pageSize && (
              <div className="mt-8 flex justify-center">
                <Pagination
                  currentPage={data.page}
                  totalPages={Math.ceil(data.total / data.pageSize)}
                  onPageChange={(newPage) => {
                    const next = new URLSearchParams(searchParams)
                    next.set('page', String(newPage))
                    setSearchParams(next)
                  }}
                />
              </div>
            )}
          </AsyncState>
        </div>
      </main>
    </div>
  )
}

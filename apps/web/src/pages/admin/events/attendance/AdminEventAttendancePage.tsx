import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Breadcrumb } from '../../../../components/Breadcrumb'
import { Button } from '../../../../components/Button'
import { buttonClass } from '../../../../components/buttonClass'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { PageHero } from '../../../../components/PageHero'
import { Pagination } from '../../../../components/Pagination'
import { useApi } from '../../../../hooks/useApi'
import { useAuth } from '../../../../hooks/useAuth'
import { api, ApiError } from '../../../../lib/api'
import { hasRole } from '../../../../lib/auth'
import { formatDateTime } from '../../../../lib/format'
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_OPTIONS,
  ATTENDANCE_STYLES,
  attendanceSummary,
  canEditAttendance,
} from '../attendanceState'
import type { AdminEvent, AttendanceStatus, EventRegistrationItem, RegistrationSearchResult } from '../types'

type RowError = { message: string; status: AttendanceStatus }

/**
 * PAGE-ADM-EVT-06 — điểm danh (E6, FLOW-16 bước 3-5, EVT-07, EVT-08).
 *
 * Mỗi lượt bấm gửi ngay một PATCH riêng cho đúng người đó (lưu tức thì, FLOW-16 nhánh "mất kết nối"):
 * UI cập nhật lạc quan trước, lỗi mạng chỉ hồi lại đúng hàng đó kèm nút thử lại — các hàng đã lưu giữ
 * nguyên. Nút "Chốt điểm danh" qua hộp xác nhận; sau khi chốt chỉ BOARD sửa được và mỗi thay đổi
 * bắt buộc lý do (docs/02 mục 8.3) qua hộp ConfirmDialog riêng. Kết quả của thành viên hiển thị luôn ở
 * /portal/activity-history (EVT-08 — API lưu điểm danh trên dòng đăng ký gắn userId).
 */
export function AdminEventAttendancePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const isBoard = hasRole(user, 'BOARD')

  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') || '1')

  const [notice, setNotice] = useState<string | null>(null)
  // Cập nhật lạc quan từng hàng: id đăng ký → kết quả đang hiển thị trong khi chờ server xác nhận.
  const [overrides, setOverrides] = useState<Record<string, AttendanceStatus>>({})
  const [savingIds, setSavingIds] = useState<string[]>([])
  const [rowErrors, setRowErrors] = useState<Record<string, RowError>>({})
  // Sửa sau khi chốt: hàng + kết quả đang định đặt, đi kèm hộp bắt buộc lý do.
  const [pendingEdit, setPendingEdit] = useState<{ registration: EventRegistrationItem; status: AttendanceStatus } | null>(null)
  const [finalizeOpen, setFinalizeOpen] = useState(false)

  // 404 (sai id, ngoài phạm vi ban) — AsyncState tự hiện màn "không tìm thấy".
  const { data: event, loading: loadingEvent, error: eventError, reload: reloadEvent } = useApi<AdminEvent>(
    id ? `/admin/events/${id}` : null,
  )
  const finalized = Boolean(event?.attendanceFinalizedAt)
  const editable = canEditAttendance(isBoard, finalized)

  // Điểm danh chỉ áp dụng cho đăng ký còn hiệu lực; các lượt đã hủy không liệt kê.
  const listOptions = useMemo(
    () => ({ method: 'POST' as const, body: { page, pageSize: 20, status: 'REGISTERED' as const } }),
    [page],
  )
  const { data, loading, error, reload } = useApi<RegistrationSearchResult>(
    id ? `/admin/events/${id}/registrations/search` : null,
    listOptions,
  )

  const items = useMemo(
    () => (data?.items ?? []).map((item) => ({ ...item, attendanceStatus: overrides[item.id] ?? item.attendanceStatus })),
    [data, overrides],
  )
  const summary = attendanceSummary(items)

  /**
   * Lưu một hàng NGAY khi bấm: đặt override trước để giao diện phản hồi tức thì, PATCH chạy nền.
   * Lỗi (mất mạng, 4xx) thì gỡ đúng override của hàng đó và hiện nút thử lại — phần đã lưu của các
   * hàng khác không bị ảnh hưởng (FLOW-16: "dữ liệu đã lưu không bị mất").
   */
  async function saveAttendance(registration: EventRegistrationItem, status: AttendanceStatus, reason?: string) {
    const previous = overrides[registration.id] ?? registration.attendanceStatus
    setRowErrors((current) => {
      const next = { ...current }
      delete next[registration.id]
      return next
    })
    setSavingIds((current) => (current.includes(registration.id) ? current : [...current, registration.id]))
    if (!finalized) setOverrides((current) => ({ ...current, [registration.id]: status }))
    try {
      await api(`/admin/events/${id}/registrations/${registration.id}/attendance`, {
        method: 'PATCH',
        body: { attendanceStatus: status, ...(reason ? { reason } : {}) },
      })
      // Server đã xác nhận: override trùng trạng thái thật, giữ nguyên để danh sách không nhấp nháy.
    } catch (err) {
      if (!finalized) setOverrides((current) => {
        const next = { ...current }
        if (previous === registration.attendanceStatus) delete next[registration.id]
        else next[registration.id] = previous
        return next
      })
      setRowErrors((current) => ({
        ...current,
        [registration.id]: {
          message: err instanceof ApiError ? err.message : 'Không lưu được điểm danh. Vui lòng thử lại.',
          status,
        },
      }))
      // 403 thường do sự kiện vừa bị chốt ở phiên khác: tải lại để khóa ô theo trạng thái mới nhất.
      if (err instanceof ApiError && err.status === 403) reloadEvent()
    } finally {
      setSavingIds((current) => current.filter((savedId) => savedId !== registration.id))
    }
  }

  function handleMark(registration: EventRegistrationItem, status: AttendanceStatus) {
    if (!editable) return
    if (finalized) {
      // Sau khi chốt: đi qua hộp bắt buộc lý do, không lưu vã (API cũng chặn 422 nếu thiếu lý do).
      setPendingEdit({ registration, status })
      return
    }
    saveAttendance(registration, status)
  }

  const registrations = data?.items ?? []

  return (
    <div>
      <PageHero
        tone="red"
        comment="quản trị / sự kiện / điểm danh"
        title="Điểm danh"
        lede={event ? event.title : 'Đang tải sự kiện...'}
        top={
          <Breadcrumb
            items={[
              { label: 'quản trị', to: '/admin' },
              { label: 'sự kiện', to: '/admin/events' },
              { label: event?.title ?? 'sự kiện', to: id ? `/admin/events/${id}` : '/admin/events' },
              { label: 'điểm danh' },
            ]}
          />
        }
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <Link to={`/admin/events/${id ?? ''}`} className={buttonClass('outline')}>
              &larr; Chi tiết sự kiện
            </Link>
            <Link to={id ? `/admin/events/${id}/registrations` : '#'} className={buttonClass('outline')}>
              Danh sách đăng ký &rarr;
            </Link>
            {!finalized && (
              <Button onClick={() => setFinalizeOpen(true)} disabled={loading || loadingEvent}>
                Chốt điểm danh
              </Button>
            )}
          </div>
        }
      />

      <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
        {notice && (
          <div role="status" className="mb-6 rounded-xl bg-soft p-4 font-bold text-ink">{notice}</div>
        )}

        {finalized && event && (
          <section data-rv className="mb-6 rounded-[20px] bg-ink p-6 text-paper">
            <p className="font-code text-xs font-bold uppercase tracking-[0.12em] text-apc-gold-soft">
              Đã chốt điểm danh
            </p>
            <p className="mt-2 font-bold">
              Chốt lúc {formatDateTime(event.attendanceFinalizedAt!)} bởi {event.attendanceFinalizedBy?.fullName ?? '—'}.
              {isBoard
                ? ' Bạn (Ban Chủ nhiệm) vẫn sửa được từng kết quả, mỗi thay đổi bắt buộc nhập lý do.'
                : ' Danh sách chỉ còn xem — chỉ Ban Chủ nhiệm sửa được kết quả kèm lý do (docs/02 mục 8.3).'}
            </p>
          </section>
        )}

        {/* Tiến độ điểm danh — khối bg-soft, số đếm cập nhật ngay theo từng lượt bấm */}
        <section data-rv className="rounded-[20px] bg-soft p-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {ATTENDANCE_OPTIONS.map((status) => (
              <div key={status}>
                <p className="font-code text-xs font-bold uppercase text-muted">{ATTENDANCE_LABELS[status]}</p>
                <p className="font-display text-2xl font-extrabold text-ink">{summary[status]}</p>
              </div>
            ))}
            {!finalized && (
              <p className="text-sm text-muted">
                Bấm vào một kết quả là lưu ngay — mất mạng không mất phần đã bấm trước đó (FLOW-16).
              </p>
            )}
          </div>
        </section>

        <div className="mt-8">
          <AsyncState
            loading={loading || loadingEvent}
            error={error ?? eventError}
            empty={registrations.length === 0}
            emptyText="Chưa có đăng ký nào còn hiệu lực để điểm danh."
            onRetry={() => {
              reload()
              reloadEvent()
            }}
          >
            <div className="overflow-x-auto rounded-[20px] border-2 border-ink bg-paper">
              <table className="w-full text-left text-sm text-ink">
                <thead className="border-b-2 border-ink bg-soft font-code text-xs font-bold uppercase text-muted">
                  <tr>
                    <th className="px-6 py-4">Người tham gia</th>
                    <th className="px-6 py-4">Kết quả điểm danh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {items.map((item) => {
                    const saving = savingIds.includes(item.id)
                    const rowError = rowErrors[item.id]
                    return (
                      <tr key={item.id} data-rv className="transition-colors hover:bg-soft/60">
                        <td className="px-6 py-4">
                          <div className="font-bold text-ink">{item.fullName ?? '—'}</div>
                          <div className="text-xs text-muted">{item.email ?? '—'}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="inline-block rounded-md bg-soft px-2.5 py-1 text-xs font-bold text-ink">
                              {item.attendeeType === 'MEMBER' ? 'Thành viên' : 'Khách'}
                            </span>
                            {item.studentId && <span className="font-mono text-xs text-muted">{item.studentId}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2" role={saving ? 'status' : undefined} aria-label={saving ? 'Đang lưu điểm danh' : undefined}>
                            {ATTENDANCE_OPTIONS.map((status) => {
                              const active = item.attendanceStatus === status
                              return (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => handleMark(item, status)}
                                  disabled={!editable || saving}
                                  aria-pressed={active}
                                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-apc-blue ${
                                    active ? ATTENDANCE_STYLES[status] : 'bg-soft text-muted hover:bg-apc-blue-pale hover:text-ink'
                                  } ${!editable && !active ? 'opacity-60' : ''}`}
                                >
                                  {ATTENDANCE_LABELS[status]}
                                </button>
                              )
                            })}
                            {saving && <span className="self-center font-code text-xs text-muted">Đang lưu…</span>}
                          </div>
                          {rowError && (
                            <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-apc-red">
                              <span>{rowError.message}</span>
                              <button
                                type="button"
                                onClick={() => saveAttendance(item, rowError.status)}
                                className="underline hover:no-underline"
                              >
                                Thử lại
                              </button>
                            </div>
                          )}
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

      {/* Chốt điểm danh (FLOW-16 bước 4): người chưa đánh dấu giữ Chưa điểm danh — nêu rõ trong hộp. */}
      {finalizeOpen && event && (
        <ConfirmDialog
          open
          title="Chốt điểm danh?"
          confirmLabel="Chốt điểm danh"
          danger
          reason="none"
          description={
            <>
              Sự kiện <b>{event.title}</b> sẽ chốt kết quả điểm danh của <b>{event.registeredCount}</b> đăng ký còn
              hiệu lực. Người chưa được đánh dấu sẽ giữ trạng thái <b>Chưa điểm danh</b> (FLOW-16). Sau khi chốt,
              chỉ Ban Chủ nhiệm sửa được kết quả và mỗi thay đổi bắt buộc nhập lý do.
            </>
          }
          onConfirm={async () => {
            await api(`/admin/events/${id}/attendance/finalize`, { method: 'POST' })
            setFinalizeOpen(false)
            setNotice('Đã chốt điểm danh. Kết quả hiển thị trong lịch sử hoạt động của thành viên.')
            reloadEvent()
          }}
          onClose={() => setFinalizeOpen(false)}
          onReload={() => {
            setFinalizeOpen(false)
            reloadEvent()
          }}
        />
      )}

      {/* Sửa sau khi chốt (chỉ BOARD): bắt buộc lý do — thiếu lý do API trả 422 và hộp hiện lỗi từng ô. */}
      {pendingEdit && (
        <ConfirmDialog
          open
          title="Sửa điểm danh đã chốt?"
          confirmLabel="Lưu thay đổi"
          reason="required"
          description={
            <>
              Đổi kết quả của <b>{pendingEdit.registration.fullName ?? '—'}</b> từ{' '}
              <b>{ATTENDANCE_LABELS[pendingEdit.registration.attendanceStatus]}</b> sang{' '}
              <b>{ATTENDANCE_LABELS[pendingEdit.status]}</b>. Lý do của bạn được lưu vào nhật ký audit kèm thay đổi.
            </>
          }
          onConfirm={async (values) => {
            // Gọi thẳng API để lỗi (thiếu lý do 422, mất quyền 403…) hiện ngay trong hộp như ConfirmDialog hứa.
            await api(`/admin/events/${id}/registrations/${pendingEdit.registration.id}/attendance`, {
              method: 'PATCH',
              body: { attendanceStatus: pendingEdit.status, reason: values.reason },
            })
            setOverrides((current) => ({ ...current, [pendingEdit.registration.id]: pendingEdit.status }))
            setPendingEdit(null)
            reload()
          }}
          onClose={() => setPendingEdit(null)}
        />
      )}
    </div>
  )
}

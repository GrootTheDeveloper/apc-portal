import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { Button } from '../../../components/Button'
import { buttonClass } from '../../../components/buttonClass'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Eyebrow } from '../../../components/Eyebrow'
import { inputClass, labelClass } from '../../../components/formClass'
import { useApi } from '../../../hooks/useApi'
import { useAuth } from '../../../hooks/useAuth'
import { api, ApiError } from '../../../lib/api'
import { hasRole } from '../../../lib/auth'
import { formatDate, formatDateTime, fromVnDatetimeInput, toVnDatetimeInput } from '../../../lib/format'
import { EVENT_TYPES } from '../../events/types'
import {
  ADMIN_EVENT_STATUS_LABELS,
  AUDIENCE_LABELS,
  type AdminEvent,
  type EventAudience,
} from './types'
import { affectsRegisteredUsers, validateEventForm } from './eventForm'

const AUDIENCE_OPTIONS: EventAudience[] = ['PUBLIC', 'CLUB', 'DEPARTMENT']

type AboutData = {
  departments: { id: string; name: string }[]
}

/** Thông báo lỗi của một ô nhập, hiện ngay dưới ô đó (màu đỏ khớp aria-invalid của inputClass). */
function InlineError({ message }: { message: string | undefined }) {
  if (!message) return null
  return (
    <span role="alert" className="font-body text-[15px] font-bold text-apc-red">
      {message}
    </span>
  )
}

/**
 * PAGE-ADM-EVT-03 — chi tiết và sửa sự kiện cho quản trị (E4, FLOW-15). Nội dung tách thành
 * `AdminEventDetailContent` để trang xem trước dùng lại (giống RecruitmentDetailContent).
 *
 * Luồng chỉnh sửa: chỉ DRAFT và PUBLISHED sửa được (API 409 các trạng thái khác — BR-16). Khi sự kiện
 * đang có người đăng ký, đổi thời gian diễn ra, sức chứa hay đối tượng phải qua hộp xác nhận kèm số
 * người bị ảnh hưởng (FLOW-15 nhánh thay thế). Hủy sự kiện bắt buộc lý do (EVT-09), dùng chung hộp
 * xác nhận ConfirmDialog; 409 do người khác vừa sửa thì hộp hiện nút "Tải lại" (STATE-09).
 *
 * Chưa làm: các nút Công bố (DRAFT → PUBLISHED) và Lưu trữ (→ ARCHIVED).
 */
export function AdminEventDetailContent({ event }: { event: AdminEvent }) {
  const badge = ADMIN_EVENT_STATUS_LABELS[event.status]

  const rows: { label: string; value: string }[] = [
    { label: 'Loại sự kiện', value: event.eventType },
    { label: 'Đối tượng', value: AUDIENCE_LABELS[event.audience] },
    {
      label: 'Ban quản lý',
      value: event.department ? `${event.department.name} (${event.department.code})` : 'Toàn CLB',
    },
    { label: 'Thời gian diễn ra', value: `${formatDateTime(event.startAt)} → ${formatDateTime(event.endAt)}` },
    {
      label: 'Địa điểm / trực tuyến',
      value: event.location ?? (event.onlineUrl ? 'Trực tuyến' : 'Chưa cập nhật'),
    },
    { label: 'Đầu mối liên hệ', value: event.contactPoint ?? '—' },
    {
      label: 'Cửa sổ đăng ký',
      value:
        event.registrationOpensAt || event.registrationClosesAt
          ? `${event.registrationOpensAt ? formatDate(event.registrationOpensAt) : '—'} → ${
              event.registrationClosesAt ? formatDateTime(event.registrationClosesAt) : '—'
            }`
          : 'Không nhận đăng ký qua hệ thống',
    },
    {
      label: 'Sức chứa',
      value:
        event.capacity === null
          ? `Không giới hạn (đã đăng ký: ${event.registeredCount})`
          : `${event.registeredCount} / ${event.capacity} người đã đăng ký`,
    },
    { label: 'Khách ngoại', value: event.allowGuestRegistration ? 'Cho phép đăng ký' : 'Chỉ thành viên' },
    { label: 'Người tạo', value: event.createdBy.fullName },
    { label: 'Cập nhật lần cuối', value: formatDateTime(event.updatedAt) },
  ]

  return (
    <main className="mx-auto max-w-4xl px-gutter py-10 md:py-14">
      <div className="flex flex-col gap-4 border-b-2 border-ink pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-block rounded-md px-2.5 py-1 font-code text-xs ${badge.className}`}>{badge.label}</span>
          {event.status === 'CANCELLED' && (
            <p className="font-bold text-apc-red">Lý do hủy: {event.cancelReason ?? '—'}</p>
          )}
        </div>
        <h1 className="font-display text-3xl font-extrabold text-ink md:text-4xl">{event.title}</h1>
        <p className="font-code text-sm text-muted">
          /{event.slug} · tạo {formatDate(event.createdAt)}
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="border-b border-ink/10 pb-3">
            <dt className="font-code text-[13px] font-bold uppercase text-muted">{row.label}</dt>
            <dd className="mt-1 font-bold text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10">
        <h2 className="font-display text-xl font-extrabold text-ink">Mô tả</h2>
        <div className="mt-4 flex max-w-[68ch] flex-col gap-4 text-[16px] leading-relaxed text-ink">
          {event.description.split('\n\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </section>

      {/* Công bố (DRAFT → PUBLISHED) và Lưu trữ (→ ARCHIVED) sẽ được tích hợp ở vòng kế tiếp. */}
    </main>
  )
}

/** PAGE-ADM-EVT-03 — trang chi tiết: xem, sửa (FLOW-15) và hủy sự kiện (EVT-09). */
export function AdminEventDetailPage() {
  const { id } = useParams<{ id: string }>()
  // Sai id hoặc sự kiện ngoài phạm vi ban đều 404 (docs/02 mục 12) — AsyncState tự hiện màn "không tìm thấy".
  const { data: event, loading, error, reload } = useApi<AdminEvent>(id ? `/admin/events/${id}` : null)

  const [editing, setEditing] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Số đăng ký còn hiệu lực, luôn đọc từ dữ liệu mới nhất sau mỗi lần reload (FLOW-15).
  const registeredCount = event?.registeredCount ?? 0
  const editable = event?.status === 'DRAFT' || event?.status === 'PUBLISHED'

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'quản trị', to: '/admin' },
          { label: 'sự kiện', to: '/admin/events' },
          { label: event?.title ?? 'chi tiết' },
        ]}
      />

      {notice && (
        <div className="mx-auto max-w-4xl px-gutter pt-4">
          <div role="status" className="rounded-xl bg-soft p-4 font-bold text-ink">{notice}</div>
        </div>
      )}

      <AsyncState loading={loading} error={error} empty={!event} emptyText="Không tìm thấy sự kiện." onRetry={reload}>
        {event &&
          (editing ? (
            <EventEditForm
              // Đổi key theo updatedAt để form nạp lại dữ liệu mới sau khi lưu hoặc "Tải lại".
              key={event.updatedAt}
              event={event}
              registeredCount={registeredCount}
              onClose={() => setEditing(false)}
              onSaved={() => {
                setEditing(false)
                setNotice('Đã lưu các thay đổi.')
                reload()
              }}
            />
          ) : (
            <>
              <div className="mx-auto max-w-4xl px-gutter pt-6">
                <Eyebrow className="text-apc-blue">quản lý sự kiện</Eyebrow>
              </div>
              <AdminEventDetailContent event={event} />
              <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-gutter pb-10">
                {editable && (
                  <Button
                    onClick={() => {
                      setNotice(null)
                      setEditing(true)
                    }}
                  >
                    Chỉnh sửa
                  </Button>
                )}
                {event.status === 'PUBLISHED' && (
                  <Button variant="outline" onClick={() => setCancelOpen(true)}>
                    Hủy sự kiện
                  </Button>
                )}
                <Link to={`/admin/events/${event.id}/preview`} className={buttonClass('outline')}>
                  Xem trước
                </Link>
                <Link to="/admin/events" className={buttonClass('outline')}>
                  ← Về danh sách
                </Link>
                {!editable && (
                  <p className="w-full text-sm text-muted">
                    Sự kiện đã {ADMIN_EVENT_STATUS_LABELS[event.status].label.toLowerCase()} nên không sửa được nữa
                    (BR-16).
                  </p>
                )}
              </div>

              {/* EVT-09: hủy chỉ từ PUBLISHED, bắt buộc lý do; giữ đăng ký và gửi email báo hủy. */}
              <ConfirmDialog
                open={cancelOpen}
                title="Hủy sự kiện?"
                description={
                  <>
                    Sự kiện <b>{event.title}</b> sẽ chuyển sang trạng thái <b>Đã hủy</b> và không nhận thêm đăng ký.
                    {registeredCount > 0 && (
                      <> {registeredCount} đăng ký còn hiệu lực sẽ được giữ nguyên và nhận email báo hủy.</>
                    )}{' '}
                    Lý do hủy sẽ hiển thị trên trang sự kiện công khai.
                  </>
                }
                confirmLabel="Hủy sự kiện"
                danger
                reason="required"
                onConfirm={async (values) => {
                  await api(`/admin/events/${event.id}/cancel`, {
                    method: 'POST',
                    body: { reason: values.reason },
                  })
                  setCancelOpen(false)
                  setNotice('Đã hủy sự kiện. Đăng ký được giữ nguyên và hệ thống đã gửi email báo hủy.')
                  reload()
                }}
                onClose={() => setCancelOpen(false)}
                onReload={reload}
              />
            </>
          ))}
      </AsyncState>
    </>
  )
}

/** Form sửa nội dung sự kiện: các trường của PATCH /admin/events/:id (trạng thái không sửa được). */
function EventEditForm({
  event,
  registeredCount,
  onClose,
  onSaved,
}: {
  event: AdminEvent
  registeredCount: number
  onClose: () => void
  onSaved: () => void
}) {
  const { user } = useAuth()
  const isBoard = hasRole(user, 'BOARD')

  // Ban người dùng đang quản lý, đọc từ vai trò hiệu lực của phiên (khớp managedDepartmentIds của API).
  const managedDepartmentIds = (user?.roles ?? []).flatMap((grant) =>
    grant.role === 'DEPARTMENT_MANAGER' && grant.departmentId !== null ? [grant.departmentId] : [],
  )

  const { data: aboutData, loading: loadingAbout, error: errorAbout, reload: reloadAbout } = useApi<AboutData>('/public/about')
  const departments = aboutData?.departments ?? []
  const selectableDepartments = isBoard ? departments : departments.filter((d) => managedDepartmentIds.includes(d.id))

  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description)
  const [eventType, setEventType] = useState<string>(event.eventType)
  // Đối tượng chỉ BOARD được đổi (kể từ DEPARTMENT sang CLUB/PUBLIC là hành vi công bố — docs/02 §8.3).
  const [audience, setAudience] = useState<EventAudience>(event.audience)
  const [departmentId, setDepartmentId] = useState(event.departmentId ?? '')
  /** Quản lý ban chỉ có đúng một ban: gán sẵn và khóa ô chọn; nhiều ban thì tự chọn trong số đó. */
  const departmentLocked = !isBoard && managedDepartmentIds.length === 1
  const departmentValue = departmentLocked ? managedDepartmentIds[0] : departmentId
  const [startAt, setStartAt] = useState(toVnDatetimeInput(event.startAt))
  const [endAt, setEndAt] = useState(toVnDatetimeInput(event.endAt))
  const [location, setLocation] = useState(event.location ?? '')
  const [onlineUrl, setOnlineUrl] = useState(event.onlineUrl ?? '')
  const [contactPoint, setContactPoint] = useState(event.contactPoint ?? '')
  const [registrationOpensAt, setRegistrationOpensAt] = useState(toVnDatetimeInput(event.registrationOpensAt))
  const [registrationClosesAt, setRegistrationClosesAt] = useState(toVnDatetimeInput(event.registrationClosesAt))
  const [capacity, setCapacity] = useState(event.capacity === null ? '' : String(event.capacity))
  const [allowGuestRegistration, setAllowGuestRegistration] = useState(event.allowGuestRegistration)

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false)

  const errors = validateEventForm(
    {
      title,
      description,
      audience,
      startAt,
      endAt,
      registrationOpensAt,
      registrationClosesAt,
      capacity,
      departmentId: departmentValue,
    },
    {
      registeredCount,
      requireDepartment: !isBoard,
      requireDepartmentMessage: 'Bạn không quản lý ban nào nên không sửa được sự kiện.',
    },
  )
  const hasErrors = Object.keys(errors).length > 0

  // FLOW-15 nhánh thay thế: đã có người đăng ký mà đổi thời gian, sức chứa hay đối tượng thì phải xác nhận.
  const needsUpdateConfirm = registeredCount > 0 && affectsRegisteredUsers(event, { startAt, endAt, capacity, audience })

  function handleAudienceChange(value: EventAudience) {
    setAudience(value)
    // EVT-02: chỉ sự kiện Công khai mới được cho phép khách đăng ký.
    if (value !== 'PUBLIC') setAllowGuestRegistration(false)
  }

  /** PATCH sự kiện; lỗi văng ra để ConfirmDialog tự hiện trong hộp, còn nút Chỉnh sửa thì bắt ở caller. */
  async function doUpdate() {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        eventType,
        // Quản lý ban không gửi audience: PATCH gửi CLUB/PUBLIC (kể cả không đổi) bị chặn 403.
        ...(isBoard ? { audience } : {}),
        departmentId: departmentValue || null,
        startAt: fromVnDatetimeInput(startAt),
        endAt: fromVnDatetimeInput(endAt),
        location: location.trim() || null,
        onlineUrl: onlineUrl.trim() || null,
        contactPoint: contactPoint.trim() || null,
        registrationOpensAt: registrationOpensAt ? fromVnDatetimeInput(registrationOpensAt) : null,
        registrationClosesAt: registrationClosesAt ? fromVnDatetimeInput(registrationClosesAt) : null,
        capacity: capacity.trim() ? Number(capacity) : null,
        allowGuestRegistration,
      }
      await api(`/admin/events/${event.id}`, { method: 'PATCH', body: payload })
      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (hasErrors) {
      setErrorMessage('Vui lòng kiểm tra lại các ô được đánh dấu.')
      return
    }
    setErrorMessage(null)
    if (needsUpdateConfirm) {
      setConfirmUpdateOpen(true)
      return
    }
    doUpdate().catch((caught: unknown) =>
      setErrorMessage(caught instanceof ApiError ? caught.message : 'Đã có lỗi xảy ra. Vui lòng thử lại.'),
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-gutter py-10 md:py-14">
      <Eyebrow className="text-apc-blue">chỉnh sửa sự kiện</Eyebrow>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-ink md:text-4xl">{event.title}</h1>
      <p className="mt-3 text-sm text-muted">
        Trạng thái:{' '}
        <span className={`inline-block rounded-md px-2.5 py-1 font-code text-xs ${ADMIN_EVENT_STATUS_LABELS[event.status].className}`}>
          {ADMIN_EVENT_STATUS_LABELS[event.status].label}
        </span>{' '}
        · Hiện có <b>{registeredCount}</b> đăng ký còn hiệu lực.
      </p>

      {errorMessage && (
        <div role="alert" className="mt-6 rounded-xl border-2 border-apc-red bg-apc-red-pale/40 p-4 font-bold text-apc-red">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-8">
        {/* 1. Nội dung */}
        <section className="space-y-5 rounded-xl border-2 border-ink bg-paper p-6">
          <h2 className="text-lg font-bold text-on-surface">1. Nội dung sự kiện</h2>

          <label className={labelClass}>
            Tiêu đề *
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              aria-invalid={!!errors.title}
            />
            <InlineError message={errors.title} />
          </label>

          <label className={labelClass}>
            Mô tả *
            <textarea
              required
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              aria-invalid={!!errors.description}
            />
            <InlineError message={errors.description} />
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={labelClass}>
              Loại sự kiện *
              <select className={inputClass} value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {/* eventType lưu tự do trong database: giữ giá trị cũ nếu không nằm trong danh sách. */}
                {!(EVENT_TYPES as readonly string[]).includes(eventType) && (
                  <option value={eventType}>{eventType}</option>
                )}
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Đối tượng{isBoard ? ' *' : ' (chỉ Ban Chủ nhiệm được đổi)'}
              <select
                className={inputClass}
                value={audience}
                onChange={(e) => handleAudienceChange(e.target.value as EventAudience)}
                disabled={!isBoard}
              >
                {AUDIENCE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {AUDIENCE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Chỗ trống cho upload ảnh bìa (D2): chưa gửi trường coverImageUrl khi PATCH. */}
          <div>
            <p className={labelClass}>Ảnh bìa</p>
            <div className="mt-2 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted/40 px-6 py-8 text-center">
              <span className="font-bold text-muted">Chức năng tải ảnh bìa đang được xây dựng (D2)</span>
            </div>
          </div>
        </section>

        {/* 2. Thời gian, địa điểm, liên hệ */}
        <section className="space-y-5 rounded-xl border-2 border-ink bg-paper p-6">
          <h2 className="text-lg font-bold text-on-surface">2. Thời gian và địa điểm</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={labelClass}>
              Bắt đầu *
              <input
                type="datetime-local"
                required
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className={inputClass}
                aria-invalid={!!errors.startAt}
              />
              <InlineError message={errors.startAt} />
            </label>
            <label className={labelClass}>
              Kết thúc *
              <input
                type="datetime-local"
                required
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className={inputClass}
                aria-invalid={!!errors.endAt}
              />
              <InlineError message={errors.endAt} />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={labelClass}>
              Địa điểm
              <input
                type="text"
                maxLength={200}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Link trực tuyến
              <input
                type="url"
                maxLength={2000}
                value={onlineUrl}
                onChange={(e) => setOnlineUrl(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className={labelClass}>
            Đầu mối liên hệ
            <input
              type="text"
              maxLength={200}
              value={contactPoint}
              onChange={(e) => setContactPoint(e.target.value)}
              className={inputClass}
            />
          </label>

          <AsyncState loading={loadingAbout} error={errorAbout} empty={false} onRetry={reloadAbout}>
            <label className={labelClass}>
              Ban quản lý sự kiện{!isBoard && ' *'}
              <select
                className={inputClass}
                value={departmentValue}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={departmentLocked}
                aria-invalid={!!errors.departmentId}
              >
                {departmentLocked && !selectableDepartments.some((d) => d.id === departmentValue) && (
                  <option value={departmentValue}>{loadingAbout ? 'Đang tải…' : 'Ban của bạn'}</option>
                )}
                {isBoard && <option value="">Toàn CLB (không thuộc ban — chỉ Ban Chủ nhiệm xem được)</option>}
                {selectableDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <InlineError message={errors.departmentId} />
              {departmentLocked && (
                <span className="font-body text-[15px] text-muted">
                  Đã gán sẵn theo ban bạn đang quản lý (EVT-02).
                </span>
              )}
            </label>
          </AsyncState>
        </section>

        {/* 3. Đăng ký */}
        <section className="space-y-5 rounded-xl border-2 border-ink bg-paper p-6">
          <h2 className="text-lg font-bold text-on-surface">3. Cửa sổ đăng ký</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={labelClass}>
              Mở đăng ký
              <input
                type="datetime-local"
                value={registrationOpensAt}
                onChange={(e) => setRegistrationOpensAt(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Đóng đăng ký
              <input
                type="datetime-local"
                value={registrationClosesAt}
                onChange={(e) => setRegistrationClosesAt(e.target.value)}
                className={inputClass}
                aria-invalid={!!errors.registrationClosesAt}
              />
              <InlineError message={errors.registrationClosesAt} />
            </label>
          </div>
          <p className="text-sm text-muted">Bỏ trống nếu sự kiện không nhận đăng ký qua hệ thống.</p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={labelClass}>
              Sức chứa
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Bỏ trống nếu không giới hạn"
                className={inputClass}
                aria-invalid={!!errors.capacity}
              />
              <InlineError message={errors.capacity} />
              <span className="font-body text-[15px] text-muted">
                Hiện có {registeredCount} đăng ký — sức chứa mới không được nhỏ hơn số này (FLOW-15).
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-soft p-4">
              <input
                type="checkbox"
                disabled={audience !== 'PUBLIC'}
                checked={allowGuestRegistration}
                onChange={(e) => setAllowGuestRegistration(e.target.checked)}
                className="mt-1 h-4 w-4 accent-ink"
              />
              <span className="text-sm text-ink">
                <b>Cho phép khách đăng ký</b>
                <span className="mt-1 block text-xs text-muted">
                  Chỉ áp dụng cho sự kiện Công khai (EVT-02); nội bộ ban hay toàn CLB thì chỉ thành viên đăng ký.
                </span>
              </span>
            </label>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Đóng, không lưu
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>

      {/* FLOW-15: nêu rõ số người bị ảnh hưởng; xác nhận thì mới gửi PATCH. */}
      <ConfirmDialog
        open={confirmUpdateOpen}
        title="Xác nhận thay đổi?"
        description={
          <>
            Sự kiện đang có <b>{registeredCount}</b> đăng ký còn hiệu lực. Bạn đang đổi{' '}
            <b>thời gian diễn ra, sức chứa hoặc đối tượng</b> — thay đổi sẽ áp dụng cho toàn bộ số người này.
          </>
        }
        confirmLabel="Xác nhận và lưu"
        reason="none"
        onConfirm={async () => {
          await doUpdate()
          setConfirmUpdateOpen(false)
        }}
        onClose={() => setConfirmUpdateOpen(false)}
      />
    </main>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '../../../components/Button'
import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { buttonClass } from '../../../components/buttonClass'
import { Eyebrow } from '../../../components/Eyebrow'
import { FileUpload } from '../../../components/FileUpload'
import { inputClass, labelClass } from '../../../components/formClass'
import { useApi } from '../../../hooks/useApi'
import { useAuth } from '../../../hooks/useAuth'
import { api, ApiError } from '../../../lib/api'
import { fromVnDatetimeInput } from '../../../lib/format'
import { hasRole } from '../../../lib/auth'
import { EVENT_TYPES } from '../../events/types'
import { AUDIENCE_LABELS, type EventAudience } from './types'
import { validateEventForm } from './eventForm'

type AboutData = {
  departments: { id: string; name: string }[]
}

const AUDIENCE_OPTIONS: EventAudience[] = ['PUBLIC', 'CLUB', 'DEPARTMENT']

/**
 * PAGE-ADM-EVT-02 — trang tạo sự kiện (E4, FLOW-15 bước 1). API luôn tạo ở trạng thái DRAFT,
 * slug tự sinh từ tiêu đề. Thời gian và trường bắt buộc được kiểm ngay trên form qua
 * `validateEventForm` (eventForm.ts), khớp `eventCreateSchema` của API — sai bước API vẫn chặn 422.
 *
 * Phân quyền (EVT-02): BOARD chọn được ban nào hoặc bỏ trống cho sự kiện toàn CLB; quản lý ban
 * bị khóa vào đúng ban mình đang quản lý (một ban) hoặc chọn trong các ban mình quản lý (nhiều ban).
 * Sự kiện đối tượng "Nội bộ ban" bắt buộc chọn ban cụ thể, kể cả với BOARD.
 * Danh sách ban lấy từ /public/about — API chỉ trả ban ACTIVE nên ban ARCHIVED không xuất hiện.
 *
 * Ảnh bìa upload qua module tệp D2 (FileUpload → POST /portal/files, purpose CONTENT_IMAGE);
 * API nhận trường coverImageUrl dạng "/api/public/files/<id>".
 */
export function AdminEventNewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isBoard = hasRole(user, 'BOARD')

  // Ban người dùng đang quản lý, đọc từ vai trò hiệu lực của phiên (khớp managedDepartmentIds của API).
  const managedDepartmentIds = (user?.roles ?? []).flatMap((grant) =>
    grant.role === 'DEPARTMENT_MANAGER' && grant.departmentId !== null ? [grant.departmentId] : [],
  )

  // Danh sách ban cho ô "Ban quản lý" — /public/about chỉ trả ban ACTIVE (ban ARCHIVED bị loại sẵn phía API).
  const { data: aboutData, loading: loadingAbout, error: errorAbout, reload: reloadAbout } = useApi<AboutData>('/public/about')
  const departments = aboutData?.departments ?? []
  const selectableDepartments = isBoard ? departments : departments.filter((d) => managedDepartmentIds.includes(d.id))

  const [departmentId, setDepartmentId] = useState('')
  /** Quản lý ban chỉ có đúng một ban: gán sẵn và khóa ô chọn; nhiều ban thì tự chọn trong số đó. */
  const departmentLocked = !isBoard && managedDepartmentIds.length === 1
  const departmentValue = departmentLocked ? managedDepartmentIds[0] : departmentId

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  // Ảnh bìa dạng "/api/public/files/<id>" — FileUpload trả id sau khi tải lên (D2).
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [eventType, setEventType] = useState<string>(EVENT_TYPES[0])
  const [audience, setAudience] = useState<EventAudience>('PUBLIC')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [location, setLocation] = useState('')
  const [onlineUrl, setOnlineUrl] = useState('')
  const [contactPoint, setContactPoint] = useState('')
  const [registrationOpensAt, setRegistrationOpensAt] = useState('')
  const [registrationClosesAt, setRegistrationClosesAt] = useState('')
  const [capacity, setCapacity] = useState('')
  const [allowGuestRegistration, setAllowGuestRegistration] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Kiểm tra sống theo từng lần gõ: lỗi hiện ngay dưới ô tương ứng trước cả khi bấm lưu.
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
      requireDepartment: !isBoard,
      requireDepartmentMessage:
        managedDepartmentIds.length > 1
          ? 'Bạn quản lý nhiều ban, hãy chọn ban quản lý sự kiện.'
          : 'Bạn không quản lý ban nào nên không tạo được sự kiện.',
    },
  )
  const hasErrors = Object.keys(errors).length > 0

  function handleAudienceChange(value: EventAudience) {
    setAudience(value)
    // EVT-02: chỉ sự kiện Công khai mới được cho phép khách đăng ký.
    if (value !== 'PUBLIC') setAllowGuestRegistration(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (hasErrors) {
      setErrorMessage('Vui lòng kiểm tra lại các ô được đánh dấu.')
      return
    }
    setErrorMessage(null)
    setSubmitting(true)

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        eventType,
        audience,
        coverImageUrl: coverImageUrl.trim() || null,
        departmentId: departmentValue || null,
        startAt: fromVnDatetimeInput(startAt),
        endAt: fromVnDatetimeInput(endAt),
        location: location.trim() || null,
        onlineUrl: onlineUrl.trim() || null,
        contactPoint: contactPoint.trim() || null,
        registrationOpensAt: registrationOpensAt ? fromVnDatetimeInput(registrationOpensAt) : null,
        registrationClosesAt: registrationClosesAt ? fromVnDatetimeInput(registrationClosesAt) : null,
        capacity: capacity ? Number(capacity) : null,
        allowGuestRegistration,
      }

      const created = await api<{ id: string }>('/admin/events', { method: 'POST', body: payload })
      navigate(`/admin/events/${created.id}`)
    } catch (err: unknown) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Đã có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-gutter py-10 md:py-14">
      <Breadcrumb
        items={[
          { label: 'quản trị', to: '/admin' },
          { label: 'sự kiện', to: '/admin/events' },
          { label: 'tạo sự kiện' },
        ]}
      />

      <Eyebrow className="text-apc-blue">quản lý sự kiện</Eyebrow>
      <h1 className="mt-2 text-3xl font-extrabold text-on-surface md:text-4xl">Tạo sự kiện mới</h1>
      <p className="mt-3 text-sm text-muted">
        Sự kiện mới luôn ở trạng thái <b>Bản nháp</b>, chỉ người quản trị xem được; công bố sau ở trang chi tiết.
      </p>

      {errorMessage && (
        <div role="alert" className="mt-6 rounded-xl bg-apc-red-pale p-4 font-bold text-apc-red">
          {errorMessage}
        </div>
      )}

      {/* noValidate: dùng thông báo lỗi riêng của form thay vì bong bóng mặc định của trình duyệt. */}
      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-8">
        {/* 1. Nội dung — khối màu đặc, không viền (DESIGN.md) */}
        <section className="space-y-5 rounded-xl bg-soft p-6">
          <h2 className="text-lg font-bold text-on-surface">1. Nội dung sự kiện</h2>

          <label className={labelClass}>
            Tiêu đề *
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Workshop Git nâng cao cho thành viên"
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
              placeholder="Giới thiệu nội dung, chương trình, ai nên tham gia…"
              className={inputClass}
              aria-invalid={!!errors.description}
            />
            <InlineError message={errors.description} />
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={labelClass}>
              Loại sự kiện *
              <select className={inputClass} value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Đối tượng *
              <select
                className={inputClass}
                value={audience}
                onChange={(e) => handleAudienceChange(e.target.value as EventAudience)}
              >
                {AUDIENCE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {AUDIENCE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Ảnh bìa upload qua D2; API nhận coverImageUrl dạng "/api/public/files/<id>". */}
          <div>
            <p className={labelClass}>Ảnh bìa</p>
            {coverImageUrl && (
              <img src={coverImageUrl} alt="Ảnh bìa đã chọn" className="mt-2 max-h-48 w-auto rounded-xl object-contain" />
            )}
            <div className="mt-2">
              <FileUpload
                purpose="CONTENT_IMAGE"
                label={coverImageUrl ? 'Chọn ảnh bìa khác' : 'Chọn ảnh bìa'}
                onUploaded={(id) => setCoverImageUrl(`/api/public/files/${id}`)}
              />
            </div>
          </div>
        </section>

        {/* 2. Thời gian, địa điểm, liên hệ */}
        <section className="space-y-5 rounded-xl bg-soft p-6">
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
                placeholder="VD: Phòng B202, UMT"
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
                placeholder="https://meet.google.com/…"
                className={inputClass}
              />
            </label>
          </div>
          <p className="text-sm text-muted">Nếu sự kiện trực tuyến, bỏ trống địa điểm và điền link.</p>

          <label className={labelClass}>
            Đầu mối liên hệ
            <input
              type="text"
              maxLength={200}
              value={contactPoint}
              onChange={(e) => setContactPoint(e.target.value)}
              placeholder="VD: Trần Thị B — ban Truyền thông"
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
                {/* Quản lý ban bị khóa chọn: ô vẫn cần option của ban đang gán để hiện đúng tên. */}
                {departmentLocked && !selectableDepartments.some((d) => d.id === departmentValue) && (
                  <option value={departmentValue}>{loadingAbout ? 'Đang tải…' : 'Ban của bạn'}</option>
                )}
                {isBoard && (
                  <option value="" disabled={audience === 'DEPARTMENT'}>
                    Toàn CLB (không thuộc ban — chỉ Ban Chủ nhiệm xem được)
                  </option>
                )}
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
        <section className="space-y-5 rounded-xl bg-soft p-6">
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
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-paper p-4">
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
          <Link to="/admin/events" className={buttonClass('outline')}>
            Hủy bỏ
          </Link>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Đang lưu…' : 'Tạo bản nháp'}
          </Button>
        </div>
      </form>
    </main>
  )
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

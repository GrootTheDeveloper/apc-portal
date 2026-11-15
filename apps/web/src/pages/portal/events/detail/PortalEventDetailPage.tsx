import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Button } from '../../../../components/Button'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { StatusScreen } from '../../../../components/StatusScreen'
import { buttonClass } from '../../../../components/buttonClass'
import { api, ApiError } from '../../../../lib/api'
import { EVENT_STATUS_STYLES, eventPhoto, type EventCardStatus } from '../../../../lib/eventVisual'
import { formatDate, formatDateTime, formatTime, vnParts } from '../../../../lib/format'
import { useApi } from '../../../../hooks/useApi'
import {
  memberCancellationOpen,
  memberRegistrationState,
  type MemberCancellationResult,
  type MemberRegistrationResult,
  type PortalEventDetail,
} from '../types'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/** URL do người dùng nhập chỉ nhận http/https (Sitemap §7.2). */
const safeHttpUrl = (value: string | null): string | null => (value && /^https?:\/\//.test(value) ? value : null)

const AUDIENCE_LABELS: Record<PortalEventDetail['audience'], string> = {
  PUBLIC: 'Công khai',
  CLUB: 'Toàn CLB',
  DEPARTMENT: 'Nội bộ ban',
}

type RegistrationDelta = {
  /** Độ lệch số người đã đăng ký so với dữ liệu server tải lần đầu (đăng ký +1, hủy −1). */
  registeredCountDelta: number
  myRegistration: NonNullable<PortalEventDetail['myRegistration']>
}

/** PAGE-MEM-05 — chi tiết và đăng ký sự kiện trong portal (E5, FLOW-14 luồng 1). */
export function PortalEventDetailPage() {
  const { id } = useParams()
  if (!id) {
    return (
      <StatusScreen
        compact
        code="404"
        title="Không tìm thấy sự kiện"
        text="Sự kiện không tồn tại hoặc không thuộc phạm vi bạn được xem."
        action={
          <Link className={buttonClass('outline')} to="/portal/events">
            Về danh sách sự kiện
          </Link>
        }
      />
    )
  }
  // key theo id: mở sự kiện khác là dựng lại từ đầu, trạng thái đăng ký tạm không dính sang sự kiện mới.
  return <PortalEventDetail key={id} eventId={id} />
}

function PortalEventDetail({ eventId }: { eventId: string }) {
  const query = useApi<PortalEventDetail>(`/portal/events/${eventId}`)
  // Kết quả đăng ký/hủy cập nhật thẳng từ phản hồi của API (như trang tra cứu), không phải tải lại trang;
  // server vẫn là nguồn sự thật — query.reload() (nút Tải lại của hộp 409) lấy dữ liệu mới về.
  const [delta, setDelta] = useState<RegistrationDelta | null>(null)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const data = query.data
  const detail: PortalEventDetail | null = data
    ? {
        ...data,
        registeredCount: data.registeredCount + (delta?.registeredCountDelta ?? 0),
        myRegistration: delta?.myRegistration ?? data.myRegistration,
      }
    : null

  if (query.error?.status === 404) {
    return (
      <StatusScreen
        compact
        code="404"
        title="Không tìm thấy sự kiện"
        text="Sự kiện không tồn tại hoặc không thuộc phạm vi bạn được xem."
        action={
          <Link className={buttonClass('outline')} to="/portal/events">
            Về danh sách sự kiện
          </Link>
        }
      />
    )
  }
  if (query.loading) {
    return (
      <AsyncState loading empty={false}>
        {null}
      </AsyncState>
    )
  }
  if (query.error || !detail) {
    return (
      <AsyncState loading={false} error={query.error} empty={false} onRetry={query.reload}>
        {null}
      </AsyncState>
    )
  }

  const statusStyle = EVENT_STATUS_STYLES[detail.status as EventCardStatus]
  const registration = memberRegistrationState(detail)
  const registered = detail.myRegistration?.status === 'REGISTERED'
  const cancelled = detail.myRegistration?.status === 'CANCELLED'
  const canCancel = registered && memberCancellationOpen(detail)
  const start = vnParts(detail.startAt)
  const end = vnParts(detail.endAt)
  const sameDay = start.year === end.year && start.month === end.month && start.day === end.day
  const timeText = sameDay
    ? `${formatDateTime(detail.startAt)} – ${formatTime(detail.endAt)}`
    : `${formatDateTime(detail.startAt)} – ${formatDateTime(detail.endAt)}`
  const onlineUrl = safeHttpUrl(detail.onlineUrl)
  const seatsLeft = detail.capacity === null ? null : Math.max(0, detail.capacity - detail.registeredCount)

  async function handleRegister() {
    setPending(true)
    setNotice(null)
    try {
      const result = await api<MemberRegistrationResult>(`/portal/events/${eventId}/registrations`, { method: 'POST' })
      setDelta((current) => ({
        registeredCountDelta: (current?.registeredCountDelta ?? 0) + (result.alreadyRegistered ? 0 : 1),
        myRegistration: { status: 'REGISTERED', registeredAt: result.registeredAt, cancelledAt: null },
      }))
      setNotice({
        kind: 'success',
        text: result.alreadyRegistered
          ? 'Bạn đã đăng ký sự kiện này từ trước.'
          : 'Đã đăng ký thành công. Email xác nhận đã được gửi tới địa chỉ email trong hồ sơ của bạn.',
      })
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof ApiError ? error.message : 'Đã có lỗi xảy ra. Vui lòng thử lại.' })
    } finally {
      setPending(false)
    }
  }

  async function handleCancel() {
    const result = await api<MemberCancellationResult>(`/portal/events/${eventId}/registrations/cancel`, { method: 'POST' })
    setDelta((current) => ({
      registeredCountDelta: (current?.registeredCountDelta ?? 0) - 1,
      myRegistration: {
        status: 'CANCELLED',
        registeredAt: current?.myRegistration.registeredAt ?? result.cancelledAt,
        cancelledAt: result.cancelledAt,
      },
    }))
    setNotice({ kind: 'success', text: 'Đã hủy đăng ký. Email xác nhận hủy đã được gửi tới địa chỉ email trong hồ sơ của bạn.' })
  }

  const metaRows: { label: string; content: ReactNode }[] = [
    { label: 'thời gian', content: timeText },
    {
      label: detail.location ? 'địa điểm' : 'hình thức',
      content: detail.location
        ? detail.location
        : onlineUrl
          ? (
              <a href={onlineUrl} target="_blank" rel="noopener noreferrer" className="text-apc-blue underline decoration-2 underline-offset-4">
                Trực tuyến ↗<span className="sr-only"> (mở tab mới)</span>
              </a>
            )
          : 'Trực tuyến',
    },
    { label: 'ban tổ chức', content: detail.departmentName ?? 'CLB APC' },
    { label: 'đầu mối liên hệ', content: detail.contactPoint ?? 'CLB APC' },
    {
      label: 'đối tượng',
      content:
        detail.audience === 'DEPARTMENT' && detail.departmentName
          ? `Nội bộ ${detail.departmentName}`
          : AUDIENCE_LABELS[detail.audience],
    },
  ]

  return (
    <main>
      <p className="font-code text-[16px] font-bold text-muted">
        <span aria-hidden>{'// '}</span>
        {detail.eventType.toLowerCase()}
      </p>
      <h1 className="mt-3 font-display text-[clamp(30px,3.6vw,48px)] font-extrabold leading-none tracking-[-0.03em]">
        {detail.title}
      </h1>
      <p className="mt-5 flex flex-wrap items-center gap-3">
        <b className="font-display text-[clamp(18px,1.8vw,24px)] font-bold">{timeText}</b>
        {statusStyle && detail.status !== 'PUBLISHED' && (
          <span className={`rounded-md px-2 py-1 font-code text-[13px] font-bold ${statusStyle.chipClass}`}>
            {statusStyle.label}
          </span>
        )}
        <span className="rounded-md bg-soft px-2 py-1 font-code text-[13px] font-bold text-muted">
          {AUDIENCE_LABELS[detail.audience]}
        </span>
      </p>
      {detail.status === 'CANCELLED' && detail.cancelReason && (
        <p role="alert" className="mt-4 max-w-[60ch] rounded-xl bg-apc-red-pale px-4 py-3 text-[16px] font-bold text-apc-red">
          Sự kiện đã bị hủy: {detail.cancelReason}
        </p>
      )}

      <section className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
        <div data-rv className="min-w-0">
          <div className="photo aspect-[16/9] bg-soft">
            <img
              alt=""
              className={`h-full ${detail.status === 'PUBLISHED' ? '' : 'opacity-60 grayscale'}`}
              src={eventPhoto(detail.eventType, detail.coverImageUrl)}
            />
          </div>
          <div aria-label="Mô tả sự kiện" className="mt-8 flex max-w-[68ch] flex-col gap-5 text-[17px] leading-relaxed">
            {detail.description.split('\n\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>

        <aside data-rv style={delay(90)} className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <dl className="rounded-[20px] bg-soft p-6">
            {metaRows.map((row) => (
              <div key={row.label} className="border-b-2 border-ink/10 py-3 first:pt-0 last:border-0 last:pb-0">
                <dt className="font-code text-[13px] font-bold text-muted">{row.label}</dt>
                <dd className="mt-0.5 text-[16px] font-bold">{row.content}</dd>
              </div>
            ))}
          </dl>

          <div className="rounded-[20px] bg-ink p-6 text-paper">
            <p className="font-code text-[14px] font-bold text-apc-gold-soft">{'// đăng ký của bạn'}</p>
            <div className="mt-3 flex flex-col gap-3 text-[16px]" aria-live="polite">
              {(detail.registrationOpensAt || detail.registrationClosesAt) && (
                <p>
                  Nhận đăng ký:{' '}
                  <b>
                    {detail.registrationOpensAt ? formatDate(detail.registrationOpensAt) : '—'} →{' '}
                    {detail.registrationClosesAt ? formatDateTime(detail.registrationClosesAt) : '—'}
                  </b>
                </p>
              )}
              <p>
                Đã đăng ký: <b>{detail.registeredCount}</b>
                {detail.capacity !== null && (
                  <>
                    {' / '}
                    {detail.capacity} chỗ{seatsLeft === 0 ? '' : ` (còn ${seatsLeft})`}
                  </>
                )}
              </p>

              {registered ? (
                <>
                  <p className="font-bold text-apc-gold-soft">
                    Bạn đã đăng ký sự kiện này
                    {detail.myRegistration?.registeredAt ? ` từ ${formatDateTime(detail.myRegistration.registeredAt)}` : ''}.
                  </p>
                  {canCancel ? (
                    <Button variant="light" className="mt-2 w-full" onClick={() => setConfirming(true)}>
                      Hủy đăng ký
                    </Button>
                  ) : (
                    <p className="text-[15px] leading-relaxed text-paper/80">
                      Đã hết thời hạn hủy đăng ký cho sự kiện này. Vui lòng liên hệ đầu mối liên hệ nếu cần hỗ trợ.
                    </p>
                  )}
                </>
              ) : cancelled ? (
                <>
                  <p className="font-bold text-apc-gold-soft">
                    Bạn đã hủy đăng ký
                    {detail.myRegistration?.cancelledAt ? ` từ ${formatDateTime(detail.myRegistration.cancelledAt)}` : ''}.
                  </p>
                  {registration === 'open' && (detail.capacity === null || seatsLeft === null || seatsLeft > 0) && (
                    <Button className="mt-2 w-full" onClick={handleRegister} disabled={pending}>
                      {pending ? 'Đang xử lý…' : 'Đăng ký lại'}
                    </Button>
                  )}
                </>
              ) : registration === null ? (
                <p>{detail.status === 'CANCELLED' ? 'Sự kiện đã hủy, không nhận đăng ký.' : 'Sự kiện đã kết thúc, không nhận đăng ký.'}</p>
              ) : registration === 'not_open' ? (
                <p className="font-bold text-apc-gold-soft">
                  Đăng ký mở vào {formatDateTime(detail.registrationOpensAt ?? detail.startAt)}.
                </p>
              ) : registration === 'closed' ? (
                <p className="font-bold text-apc-gold-soft">
                  Đã hết hạn đăng ký{detail.registrationClosesAt ? ` từ ${formatDateTime(detail.registrationClosesAt)}` : ''}.
                </p>
              ) : (
                <>
                  {detail.capacity !== null && seatsLeft === 0 ? (
                    <p className="font-bold text-apc-gold-soft">Sự kiện đã hết chỗ.</p>
                  ) : (
                    <Button className="mt-2 w-full" onClick={handleRegister} disabled={pending}>
                      {pending ? 'Đang xử lý…' : 'Đăng ký'}
                    </Button>
                  )}
                </>
              )}
            </div>

            {notice && (
              <p
                role={notice.kind === 'success' ? 'status' : 'alert'}
                className={`mt-4 rounded-xl px-4 py-3 text-[15px] font-bold ${
                  notice.kind === 'success' ? 'bg-apc-blue-pale text-ink' : 'bg-apc-red text-paper'
                }`}
              >
                {notice.text}
              </p>
            )}
          </div>
        </aside>
      </section>

      {/* Hộp xác nhận hành động nhạy cảm: nêu đối tượng và ảnh hưởng (STATE-07); lỗi 409 có nút Tải lại */}
      <ConfirmDialog
        open={confirming}
        title="Hủy đăng ký sự kiện?"
        description={
          <>
            Bạn sẽ hủy đăng ký cho sự kiện <b>{detail.title}</b>. Hủy xong chỗ của bạn được trả lại cho người khác; trong
            thời gian nhận đăng ký bạn có thể đăng ký lại.
          </>
        }
        confirmLabel="Xác nhận hủy đăng ký"
        danger
        reason="none"
        onConfirm={handleCancel}
        onClose={() => setConfirming(false)}
        onReload={query.reload}
      />
    </main>
  )
}

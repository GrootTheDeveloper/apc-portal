import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ReactNode } from 'react'

import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { EVENT_STATUS_STYLES, eventTypeVisual, type EventCardStatus } from '../../../lib/eventVisual'
import { NotFound } from '../../NotFound'
import { formatDate, formatDateTime, formatTime, vnParts } from '../../../lib/format'
import { useMockApi } from '../../../hooks/useMockApi'
import { getEventBySlug, type EventDetail } from '../mock'

/** Chỉ mở đăng ký khi sự kiện còn diễn ra và trong thời gian nhận đăng ký (BR-08). */
function registrationState(event: EventDetail): 'open' | 'not_open' | 'closed' | null {
  if (event.status !== 'PUBLISHED') return null
  const now = Date.now()
  if (event.registrationOpensAt && now < new Date(event.registrationOpensAt).getTime()) return 'not_open'
  if (event.registrationClosesAt && now > new Date(event.registrationClosesAt).getTime()) return 'closed'
  return 'open'
}

/** URL do người dùng nhập chỉ nhận http/https (Sitemap §7.2). */
const safeHttpUrl = (value: string | null): string | null => (value && /^https?:\/\//.test(value) ? value : null)

/** PAGE-PUB-06 — chi tiết sự kiện công khai. */
export function EventDetailPage() {
  const { slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const event = useMockApi(() => (slug ? getEventBySlug(slug) : Promise.reject(new Error('missing slug'))), [slug])

  if (event.error?.status === 404) return <NotFound />
  if (event.loading) {
    return (
      <main className="mx-auto w-full max-w-container-max px-gutter py-12 md:py-16">
        <AsyncState loading empty={false}>{null}</AsyncState>
      </main>
    )
  }
  if (event.error || !event.data) {
    return (
      <main className="mx-auto w-full max-w-container-max px-gutter py-12 md:py-16">
        <AsyncState loading={false} error={event.error} empty={false} onRetry={event.reload}>
          {null}
        </AsyncState>
      </main>
    )
  }

  const data = event.data
  const backTo = (location.state as { from?: string } | null)?.from ?? '/events'
  const visual = eventTypeVisual(data.eventType)
  const statusStyle = EVENT_STATUS_STYLES[data.status as EventCardStatus]
  const registration = registrationState(data)
  const start = vnParts(data.startAt)
  const end = vnParts(data.endAt)
  const sameDay = start.year === end.year && start.month === end.month && start.day === end.day
  const timeText = sameDay
    ? `${formatDateTime(data.startAt)} – ${formatTime(data.endAt)}`
    : `${formatDateTime(data.startAt)} – ${formatDateTime(data.endAt)}`
  const onlineUrl = safeHttpUrl(data.onlineUrl)
  const descriptionParagraphs = data.description.split('\n\n')

  const metaRows: { icon: string; label: string; content: ReactNode }[] = [
    {
      icon: 'schedule',
      label: 'Thời gian',
      content: <span className="text-on-surface">{timeText}</span>,
    },
    {
      icon: data.location ? 'location_on' : 'videocam',
      label: data.location ? 'Địa điểm' : 'Hình thức',
      content: data.location ? (
        <span className="text-on-surface">{data.location}</span>
      ) : onlineUrl ? (
        <a href={onlineUrl} target="_blank" rel="noopener noreferrer" className="text-apc-blue hover:underline">
          Trực tuyến <span className="material-symbols-outlined inline-block align-[-2px] text-sm">open_in_new</span>
        </a>
      ) : (
        <span className="text-on-surface">Trực tuyến</span>
      ),
    },
    {
      icon: 'groups',
      label: 'Ban tổ chức',
      content: <span className="text-on-surface">{data.departmentName ?? 'CLB APC'}</span>,
    },
    {
      icon: 'support_agent',
      label: 'Đầu mối liên hệ',
      content: <span className="text-on-surface">{data.contactPoint ?? 'CLB APC'}</span>,
    },
  ]

  return (
    <main className="mx-auto w-full max-w-container-max px-gutter py-12 md:py-16">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-on-surface-variant">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link to="/" className="hover:text-apc-blue hover:underline">
              Trang chủ
            </Link>
          </li>
          <li aria-hidden className="material-symbols-outlined text-sm">chevron_right</li>
          <li>
            <Link to={backTo} className="hover:text-apc-blue hover:underline">
              Sự kiện
            </Link>
          </li>
          <li aria-hidden className="material-symbols-outlined text-sm">chevron_right</li>
          <li aria-current="page" className="text-on-surface">
            {data.title}
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className={`relative aspect-[16/9] flex items-center justify-center rounded-2xl border border-outline-variant/20 bg-gradient-to-br ${visual.coverClass}`}>
            {data.coverImageUrl ? (
              <img src={data.coverImageUrl} alt={data.title} className="h-full w-full rounded-2xl object-cover" />
            ) : (
              <span className={`material-symbols-outlined text-7xl ${visual.iconClass}`}>{visual.icon}</span>
            )}
          </div>

          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${visual.chipClass}`}>{data.eventType}</span>
              {statusStyle && <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusStyle.chipClass}`}>{statusStyle.label}</span>}
            </div>
            <h1 className="text-3xl font-bold text-on-surface md:text-4xl">{data.title}</h1>
            {data.status === 'CANCELLED' && data.cancelReason && (
              <p className="rounded-apc border border-apc-red/30 bg-apc-red/5 px-4 py-3 text-sm text-apc-red">
                <span className="font-bold">Lý do hủy: </span>
                {data.cancelReason}
              </p>
            )}
          </header>

          <section aria-label="Mô tả sự kiện" className="flex flex-col gap-4">
            {descriptionParagraphs.map((paragraph, index) => (
              <p key={index} className="leading-relaxed text-on-surface-variant">
                {paragraph}
              </p>
            ))}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <div className="rounded-2xl border border-outline-variant/20 bg-white p-6">
            <Eyebrow className="text-on-surface-variant mb-4">THÔNG TIN</Eyebrow>
            <dl className="flex flex-col gap-4">
              {metaRows.map((row) => (
                <div key={row.label} className="flex gap-3">
                  <span className="material-symbols-outlined text-xl text-apc-blue/70">{row.icon}</span>
                  <div className="flex flex-col">
                    <dt className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{row.label}</dt>
                    <dd className="text-sm">{row.content}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6">
            <Eyebrow className="text-on-surface-variant mb-4">ĐĂNG KÝ</Eyebrow>
            {registration === null ? (
              <p className="text-sm text-on-surface-variant">
                {data.status === 'CANCELLED'
                  ? 'Sự kiện đã hủy, không nhận đăng ký.'
                  : 'Sự kiện đã kết thúc, không nhận đăng ký.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3 text-sm text-on-surface-variant">
                {(data.registrationOpensAt || data.registrationClosesAt) && (
                  <p>
                    Thời gian nhận đăng ký:{' '}
                    <span className="text-on-surface">
                      {data.registrationOpensAt ? formatDate(data.registrationOpensAt) : '—'} →{' '}
                      {data.registrationClosesAt ? formatDateTime(data.registrationClosesAt) : '—'}
                    </span>
                  </p>
                )}
                <p>
                  Sức chứa: <span className="text-on-surface">{data.capacity ? `${data.capacity} người` : 'Không giới hạn'}</span>
                </p>
                {registration === 'open' ? (
                  <>
                    <Button onClick={() => navigate(`/events/${data.slug}/register`)}>Đăng ký tham gia</Button>
                    {data.registrationClosesAt && (
                      <p className="text-xs">Nhận đăng ký đến {formatDateTime(data.registrationClosesAt)}</p>
                    )}
                  </>
                ) : registration === 'not_open' ? (
                  <p className="text-on-surface">
                    <span className="material-symbols-outlined mr-1 inline-block align-[-3px] text-base">schedule</span>
                    Đăng ký sẽ mở vào {formatDateTime(data.registrationOpensAt ?? data.startAt)}
                  </p>
                ) : (
                  <p className="text-on-surface">
                    <span className="material-symbols-outlined mr-1 inline-block align-[-3px] text-base">event_busy</span>
                    Đã hết hạn đăng ký{data.registrationClosesAt ? ` từ ${formatDateTime(data.registrationClosesAt)}` : ''}.
                  </p>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}

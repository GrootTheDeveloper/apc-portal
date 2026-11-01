import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ReactNode } from 'react'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { Button } from '../../../components/Button'
import { PageHero } from '../../../components/PageHero'
import { Seo } from '../../../components/Seo'
import { EVENT_STATUS_STYLES, eventPhoto, type EventCardStatus } from '../../../lib/eventVisual'
import { NotFound } from '../../NotFound'
import { formatDate, formatDateTime, formatTime, vnParts } from '../../../lib/format'
import { useApi } from '../../../hooks/useApi'
import type { EventDetail } from '../types'

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

  const event = useApi<EventDetail>(slug ? `/public/events/${slug}` : null)

  if (event.error?.status === 404) return <NotFound />
  if (event.loading) {
    return (
      <main className="mx-auto w-full max-w-container-max px-4 md:px-8">
        <AsyncState loading empty={false}>{null}</AsyncState>
      </main>
    )
  }
  if (event.error || !event.data) {
    return (
      <main className="mx-auto w-full max-w-container-max px-4 md:px-8">
        <AsyncState loading={false} error={event.error} empty={false} onRetry={event.reload}>
          {null}
        </AsyncState>
      </main>
    )
  }

  const data = event.data
  const backTo = (location.state as { from?: string } | null)?.from ?? '/events'
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

  const metaRows: { label: string; content: ReactNode }[] = [
    { label: 'thời gian', content: timeText },
    {
      label: data.location ? 'địa điểm' : 'hình thức',
      content: data.location ? (
        data.location
      ) : onlineUrl ? (
        <a href={onlineUrl} target="_blank" rel="noopener noreferrer" className="text-apc-blue underline decoration-2 underline-offset-4">
          Trực tuyến ↗<span className="sr-only"> (mở tab mới)</span>
        </a>
      ) : (
        'Trực tuyến'
      ),
    },
    { label: 'ban tổ chức', content: data.departmentName ?? 'CLB APC' },
    { label: 'đầu mối liên hệ', content: data.contactPoint ?? 'CLB APC' },
  ]

  return (
    <main>
      {/* SEO-01: title, description, canonical, Open Graph; mô tả lấy đoạn đầu nội dung */}
      <Seo
        title={data.title}
        description={data.description.split('\n\n')[0].slice(0, 160)}
        path={`/events/${data.slug}`}
        imageUrl={data.coverImageUrl}
      />
      <PageHero
        tone="blue"
        top={
          <Breadcrumb
            items={[
              { label: 'trang chủ', to: '/' },
              { label: 'sự kiện', to: backTo },
              { label: data.title },
            ]}
          />
        }
        compact
        comment={data.eventType.toLowerCase()}
        title={data.title}
      >
        <p className="mt-6 flex flex-wrap items-center gap-3">
          <b className="font-display text-[clamp(20px,2vw,26px)] font-bold">{timeText}</b>
          {statusStyle && data.status !== 'PUBLISHED' && (
            <span className={`rounded-md px-2 py-1 font-code text-[13px] font-bold ${statusStyle.chipClass}`}>{statusStyle.label}</span>
          )}
        </p>
        {data.status === 'CANCELLED' && data.cancelReason && (
          <p className="mt-4 max-w-[60ch] rounded-xl bg-paper px-4 py-3 text-[16px] text-apc-red">
            <b>Lý do hủy: </b>
            {data.cancelReason}
          </p>
        )}
      </PageHero>

      <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
        <div className="mx-auto grid w-full max-w-container-max gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
          <div className="min-w-0">
            <div data-rv className="photo aspect-[16/9] bg-soft">
              <img
                alt=""
                className={`h-full ${data.status === 'PUBLISHED' ? '' : 'opacity-60 grayscale'}`}
                src={eventPhoto(data.eventType, data.coverImageUrl)}
              />
            </div>
            <div aria-label="Mô tả sự kiện" className="mt-10 flex max-w-[68ch] flex-col gap-5 text-[18px] leading-relaxed">
              {descriptionParagraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>

          <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
            <dl className="rounded-[20px] bg-soft p-6">
              {metaRows.map((row) => (
                <div key={row.label} className="border-b-2 border-ink/10 py-3 first:pt-0 last:border-0 last:pb-0">
                  <dt className="font-code text-[13px] font-bold text-muted">{row.label}</dt>
                  <dd className="mt-0.5 text-[16px] font-bold">{row.content}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-[20px] bg-ink p-6 text-paper">
              <p className="font-code text-[14px] font-bold text-apc-gold-soft">{'// đăng ký'}</p>
              {registration === null ? (
                <p className="mt-3 text-[16px]">
                  {data.status === 'CANCELLED' ? 'Sự kiện đã hủy, không nhận đăng ký.' : 'Sự kiện đã kết thúc, không nhận đăng ký.'}
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-3 text-[16px]">
                  {(data.registrationOpensAt || data.registrationClosesAt) && (
                    <p>
                      Nhận đăng ký:{' '}
                      <b>
                        {data.registrationOpensAt ? formatDate(data.registrationOpensAt) : '—'} →{' '}
                        {data.registrationClosesAt ? formatDateTime(data.registrationClosesAt) : '—'}
                      </b>
                    </p>
                  )}
                  <p>
                    Sức chứa: <b>{data.capacity ? `${data.capacity} người` : 'không giới hạn'}</b>
                  </p>
                  {registration === 'open' ? (
                    <Button className="mt-2 w-full" onClick={() => navigate(`/events/${data.slug}/register`)}>
                      Đăng ký tham gia →
                    </Button>
                  ) : registration === 'not_open' ? (
                    <p className="font-bold text-apc-gold-soft">Đăng ký mở vào {formatDateTime(data.registrationOpensAt ?? data.startAt)}.</p>
                  ) : (
                    <p className="font-bold text-apc-gold-soft">
                      Đã hết hạn đăng ký{data.registrationClosesAt ? ` từ ${formatDateTime(data.registrationClosesAt)}` : ''}.
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

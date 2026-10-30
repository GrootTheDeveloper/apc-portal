import { type CSSProperties, type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '../../../components/Button'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { PageHero } from '../../../components/PageHero'
import { Seo } from '../../../components/Seo'
import { api, ApiError } from '../../../lib/api'
import { formatDateTime } from '../../../lib/format'
import type { RegistrationLookupResult } from '../types'

// Viền 2px màu mực, focus đổi sang viền xanh kèm quầng — cùng kiểu form với trang Đăng nhập (DESIGN.md).
const inputClass =
  'w-full rounded-xl bg-paper px-4 py-3 text-[17px] text-ink shadow-[inset_0_0_0_2px_#081F3D] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#1568C9,0_0_0_4px_rgba(21,104,201,0.2)] disabled:opacity-60'
const labelClass = 'flex flex-col gap-2 font-code text-[13px] font-bold'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/** URL do người dùng nhập chỉ nhận http/https (Sitemap §7.2). */
const safeHttpUrl = (value: string | null): string | null => (value && /^https?:\/\//.test(value) ? value : null)

/** PAGE-PUB-08 — tra cứu hoặc hủy đăng ký sự kiện bằng email + mã (FLOW-14). Trang riêng tư với công cụ tìm kiếm. */
export function RegistrationLookupPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [credentials, setCredentials] = useState<{ email: string; code: string } | null>(null)
  const [result, setResult] = useState<RegistrationLookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    setSubmitting(true)
    setError(null)
    setResult(null)
    setConfirming(false)
    setCancelError(null)
    const trimmed = { email: email.trim(), code: code.trim().toUpperCase() }
    try {
      const found = await api<RegistrationLookupResult>('/public/event-registrations/lookup', { body: trimmed })
      setCredentials(trimmed)
      setResult(found)
    } catch (lookupError) {
      setCredentials(null)
      setError(lookupError instanceof ApiError ? lookupError.message : 'Đã có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    if (!credentials || !result) return
    setCancelling(true)
    setCancelError(null)
    try {
      await api('/public/event-registrations/cancel', { body: credentials })
      // Hủy xong tra cứu lại để thấy trạng thái mới nhất
      setResult(await api<RegistrationLookupResult>('/public/event-registrations/lookup', { body: credentials }))
      setConfirming(false)
    } catch (cancelAttemptError) {
      setCancelError(cancelAttemptError instanceof ApiError ? cancelAttemptError.message : 'Đã có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setCancelling(false)
    }
  }

  const event = result?.event
  const onlineUrl = safeHttpUrl(event?.onlineUrl ?? null)

  return (
    <main>
      {/* Trang tra cứu: noindex, nofollow (Sitemap §16) */}
      <Seo title="Tra cứu đăng ký sự kiện" path="/events/registration-lookup" noIndex />
      <PageHero
        tone="blue"
        comment="tra cứu đăng ký"
        title="Tra cứu đăng ký sự kiện"
        lede="Nhập email và mã đăng ký bạn nhận được khi đăng ký để xem thông tin hoặc hủy đăng ký."
        top={
          <Breadcrumb
            items={[
              { label: 'trang chủ', to: '/' },
              { label: 'sự kiện', to: '/events' },
              { label: 'tra cứu đăng ký' },
            ]}
          />
        }
      />

      <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
        <div className="mx-auto grid w-full max-w-container-max gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-16">
          {/* Form tra cứu — mã và email chỉ gửi qua body, không đặt trên URL (OPS-11) */}
          <form data-rv className="flex max-w-[56ch] flex-col gap-6" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
            <p className="font-code text-[16px] font-bold text-apc-blue">{'// thông tin tra cứu'}</p>
            <label className={labelClass}>
              email đã dùng để đăng ký
              <input
                className={inputClass}
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={120}
                value={email}
                onChange={(formEvent) => setEmail(formEvent.target.value)}
                disabled={submitting || cancelling}
              />
            </label>
            <label className={labelClass}>
              mã đăng ký
              <input
                className={`${inputClass} font-code tracking-[0.12em]`}
                name="code"
                autoComplete="off"
                required
                maxLength={20}
                spellCheck={false}
                value={code}
                onChange={(formEvent) => setCode(formEvent.target.value)}
                disabled={submitting || cancelling}
              />
            </label>
            {error && (
              <p role="alert" className="rounded-xl bg-apc-red-pale px-4 py-3 text-[16px] font-bold text-apc-red">
                {error}
              </p>
            )}
            <div>
              <Button type="submit" disabled={submitting || cancelling}>
                {submitting ? 'đang tra cứu' : 'Tra cứu đăng ký'}
              </Button>
            </div>
            <p className="max-w-[48ch] text-[15px] leading-relaxed text-muted">
              Sai email hoặc sai mã nhiều lần trong 15 phút sẽ bị tạm chặn. Nếu mất mã, xem lại email xác nhận đăng ký.
            </p>
          </form>

          {/* Kết quả tra cứu: thông tin đăng ký của chính người tra cứu (BR-09) */}
          <aside data-rv style={delay(90)} className="min-w-0" aria-live="polite">
            {result && event ? (
              <div className="flex flex-col gap-6">
                <div className="rounded-[20px] bg-soft p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-code text-[14px] font-bold text-muted">{'// kết quả tra cứu'}</p>
                    <span
                      className={`rounded-md px-2 py-1 font-code text-[13px] font-bold ${
                        result.status === 'REGISTERED' ? 'bg-apc-blue-pale text-ink' : 'bg-apc-red-pale text-apc-red'
                      }`}
                    >
                      {result.status === 'REGISTERED' ? 'Đã đăng ký' : 'Đã hủy'}
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-[clamp(22px,2.2vw,30px)] font-extrabold leading-tight">
                    <Link to={`/events/${event.slug}`} className="hover:text-apc-blue hover:underline decoration-2 underline-offset-4">
                      {event.title}
                    </Link>
                  </h2>
                  <dl className="mt-4">
                    <div className="border-b-2 border-ink/10 py-3 first:pt-0">
                      <dt className="font-code text-[13px] font-bold text-muted">người đăng ký</dt>
                      <dd className="mt-0.5 text-[16px] font-bold">{result.guestFullName}</dd>
                    </div>
                    <div className="border-b-2 border-ink/10 py-3">
                      <dt className="font-code text-[13px] font-bold text-muted">thời gian</dt>
                      <dd className="mt-0.5 text-[16px] font-bold">{formatDateTime(event.startAt)}</dd>
                    </div>
                    <div className="border-b-2 border-ink/10 py-3">
                      <dt className="font-code text-[13px] font-bold text-muted">{event.location ? 'địa điểm' : 'hình thức'}</dt>
                      <dd className="mt-0.5 text-[16px] font-bold">
                        {event.location ?? (onlineUrl ? (
                          <a href={onlineUrl} target="_blank" rel="noopener noreferrer" className="text-apc-blue underline decoration-2 underline-offset-4">
                            Trực tuyến ↗<span className="sr-only"> (mở tab mới)</span>
                          </a>
                        ) : (
                          'Trực tuyến'
                        ))}
                      </dd>
                    </div>
                    <div className="border-b-2 border-ink/10 py-3">
                      <dt className="font-code text-[13px] font-bold text-muted">ban tổ chức</dt>
                      <dd className="mt-0.5 text-[16px] font-bold">{event.departmentName ?? 'CLB APC'}</dd>
                    </div>
                    <div className="border-b-2 border-ink/10 py-3">
                      <dt className="font-code text-[13px] font-bold text-muted">đăng ký lúc</dt>
                      <dd className="mt-0.5 text-[16px] font-bold">{formatDateTime(result.registeredAt)}</dd>
                    </div>
                    {result.cancelledAt && (
                      <div className="border-b-2 border-ink/10 py-3">
                        <dt className="font-code text-[13px] font-bold text-muted">hủy lúc</dt>
                        <dd className="mt-0.5 text-[16px] font-bold">{formatDateTime(result.cancelledAt)}</dd>
                      </div>
                    )}
                    <div className="py-3 last:pb-0">
                      <dt className="font-code text-[13px] font-bold text-muted">mã đăng ký</dt>
                      <dd className="mt-0.5 font-code text-[16px] font-bold tracking-[0.12em]">{credentials?.code}</dd>
                    </div>
                  </dl>
                  {event.status === 'CANCELLED' && event.cancelReason && (
                    <p className="mt-4 rounded-xl bg-paper px-4 py-3 text-[15px] font-bold text-apc-red">
                      Sự kiện đã bị hủy: {event.cancelReason}
                    </p>
                  )}
                </div>

                {result.status === 'REGISTERED' && !confirming && (
                  <div>
                    <Button variant="outline" onClick={() => setConfirming(true)} disabled={cancelling}>
                      Hủy đăng ký
                    </Button>
                  </div>
                )}

                {/* Hộp xác nhận hành động nhạy cảm: nêu đối tượng, ảnh hưởng (STATE-07) */}
                {confirming && result.status === 'REGISTERED' && (
                  <div className="rounded-[20px] bg-ink p-6 text-paper">
                    <p className="font-code text-[14px] font-bold text-apc-gold-soft">{'// xác nhận hủy đăng ký'}</p>
                    <p className="mt-3 text-[16px] leading-relaxed">
                      Bạn sẽ hủy đăng ký của <b>{result.guestFullName}</b> cho sự kiện <b>“{event.title}”</b>. Hủy xong chỗ của bạn
                      được trả lại cho người khác; trong thời hạn nhận đăng ký bạn có thể đăng ký lại bằng cùng email.
                    </p>
                    {cancelError && (
                      <p role="alert" className="mt-3 rounded-xl bg-apc-red px-4 py-3 text-[15px] font-bold text-paper">
                        {cancelError}
                      </p>
                    )}
                    <div className="mt-5 flex flex-wrap gap-4">
                      <Button variant="light" onClick={handleCancel} disabled={cancelling}>
                        {cancelling ? 'đang hủy' : 'Xác nhận hủy đăng ký'}
                      </Button>
                      <Button variant="outline" onClick={() => setConfirming(false)} disabled={cancelling}>
                        Giữ đăng ký
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div data-rv className="flex h-full flex-col justify-center gap-4 rounded-[20px] bg-soft p-8 text-muted">
                <p className="font-code text-[14px] font-bold">{'// hướng dẫn'}</p>
                <p className="max-w-[44ch] text-[17px] leading-relaxed">
                  Mã đăng ký nằm trong email xác nhận bạn nhận được sau khi đăng ký. Tra cứu thành công thì có thể xem thông
                  tin hoặc hủy đăng ký trước khi hết thời hạn nhận đăng ký của sự kiện.
                </p>
                <Link to="/events" className="font-code text-[15px] font-bold text-apc-blue underline decoration-2 underline-offset-4">
                  Xem các sự kiện đang mở →
                </Link>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  )
}

import { type CSSProperties, type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { Button } from '../../../components/Button'
import { inputClass, labelClass } from '../../../components/formClass'
import { PageHero } from '../../../components/PageHero'
import { Seo } from '../../../components/Seo'
import { api, ApiError } from '../../../lib/api'
import { formatDate, formatDateTime } from '../../../lib/format'
import { useApi } from '../../../hooks/useApi'
import { NotFound } from '../../NotFound'
import { guestRegistrationState, type EventDetail, type GuestRegistrationResult } from '../types'

type SubmitState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'error'; message: string; fields: Record<string, string> }
  | { phase: 'done'; code: string; email: string }

/** Lỗi 422 đánh dấu đúng trường, giữ nguyên dữ liệu đã nhập (ERR-422). */
function fieldErrors(error: ApiError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues ?? []) {
    const field = (issue as { path?: unknown[] }).path?.[0]
    if (typeof field === 'string' && !fields[field]) fields[field] = (issue as { message?: string }).message ?? ''
  }
  return fields
}

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/** PAGE-PUB-07 — đăng ký sự kiện công khai của khách (FLOW-14, STATE-02). Trang riêng tư với công cụ tìm kiếm. */
export function EventRegisterPage() {
  const { slug } = useParams()

  const event = useApi<EventDetail>(slug ? `/public/events/${slug}` : null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [studentId, setStudentId] = useState('')
  const [consent, setConsent] = useState(false)
  const [submit, setSubmit] = useState<SubmitState>({ phase: 'idle' })

  if (event.error?.status === 404) return <NotFound />
  if (event.loading || event.error || !event.data || !slug) {
    return (
      <main className="mx-auto w-full max-w-container-max px-4 py-16 md:px-8">
        <AsyncState loading={event.loading} error={event.error} empty={false} onRetry={event.reload}>
          {null}
        </AsyncState>
      </main>
    )
  }

  const data = event.data
  const registration = guestRegistrationState(data)
  const submitting = submit.phase === 'submitting'
  const fields = submit.phase === 'error' ? submit.fields : {}

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    setSubmit({ phase: 'submitting' })
    try {
      const result = await api<GuestRegistrationResult>(`/public/events/${slug}/registrations`, {
        body: { fullName: fullName.trim(), email: email.trim(), studentId: studentId.trim(), consent },
      })
      // STATE-02: mã đăng ký chỉ hiện một lần; tải lại không tạo đăng ký thứ hai (QĐ-1 chặn trùng).
      setSubmit({ phase: 'done', code: result.registrationCode, email: email.trim() })
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setSubmit({ phase: 'error', message: 'Đã có lỗi xảy ra. Vui lòng thử lại.', fields: {} })
        return
      }
      const fieldsFromApi = error.status === 422 ? fieldErrors(error) : {}
      setSubmit({
        phase: 'error',
        message: Object.keys(fieldsFromApi).length > 0 ? 'Thông tin chưa hợp lệ, vui lòng kiểm tra lại.' : error.message,
        fields: fieldsFromApi,
      })
    }
  }

  const errorText = (field: string) =>
    fields[field] ? <span className="font-code text-[14px] font-bold text-apc-red">{fields[field]}</span> : null

  return (
    <main>
      {/* Form công khai: noindex, nofollow (Sitemap §16) */}
      <Seo title={`Đăng ký: ${data.title}`} path={`/events/${slug}/register`} robots="noindex, nofollow" />
      <PageHero
        tone="blue"
        compact
        comment="đăng ký sự kiện"
        title={data.title}
        top={
          <Breadcrumb
            items={[
              { label: 'trang chủ', to: '/' },
              { label: 'sự kiện', to: '/events' },
              { label: data.title, to: `/events/${slug}` },
              { label: 'đăng ký' },
            ]}
          />
        }
      >
        <p data-rv className="mt-6 font-display text-[clamp(18px,1.8vw,24px)] font-bold">
          {formatDateTime(data.startAt)}
          {data.location ? ` · ${data.location}` : ' · Trực tuyến'}
        </p>
      </PageHero>

      <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
        <div className="mx-auto grid w-full max-w-container-max gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
          <div className="min-w-0">
            {submit.phase === 'done' ? (
              // STATE-02: mã đăng ký hiển thị một lần, tải lại trang không thấy lại được
              <div data-rv className="flex max-w-[64ch] flex-col gap-6" aria-live="polite">
                <p className="font-code text-[16px] font-bold text-apc-blue">{'// đăng ký thành công'}</p>
                <h2 className="font-display text-[clamp(26px,2.6vw,36px)] font-extrabold leading-tight">
                  Bạn đã đăng ký tham gia <span className="text-apc-blue">{data.title}</span>.
                </h2>
                <div className="rounded-[20px] bg-ink p-8 text-paper">
                  <p className="font-code text-[14px] font-bold text-apc-gold-soft">{'// mã đăng ký của bạn'}</p>
                  <p className="mt-4 select-all break-all font-code text-[clamp(28px,4vw,44px)] font-bold leading-tight tracking-[0.12em]">
                    {submit.code}
                  </p>
                  <p className="mt-4 text-[16px] leading-relaxed opacity-90">
                    Mã chỉ hiển thị <b>một lần</b> trên trang này — hãy lưu lại. Email xác nhận đã được gửi tới{' '}
                    <b>{submit.email}</b> (kiểm tra cả thư mục spam).
                  </p>
                </div>
                <p className="max-w-[56ch] text-[16px] leading-relaxed text-muted">
                  Dùng email và mã đăng ký để tra cứu hoặc hủy đăng ký trước khi thời hạn nhận đăng ký kết thúc.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link to="/events/registration-lookup" className="inline-flex">
                    <Button>Tra cứu / hủy đăng ký</Button>
                  </Link>
                  <Link to={`/events/${slug}`} className="inline-flex">
                    <Button variant="outline">← Về trang sự kiện</Button>
                  </Link>
                </div>
              </div>
            ) : registration !== 'open' ? (
              // Chưa mở / hết hạn / không nhận khách / sự kiện đã hủy hoặc kết thúc: thay form bằng trạng thái
              <div data-rv className="flex max-w-[64ch] flex-col gap-6" data-testid="register-blocked">
                <p className="font-code text-[16px] font-bold text-apc-blue">{'// đăng ký'}</p>
                <h2 className="font-display text-[clamp(26px,2.6vw,36px)] font-extrabold leading-tight">Sự kiện này chưa nhận đăng ký được.</h2>
                <p className="max-w-[56ch] text-[18px] leading-relaxed text-muted">
                  {registration === null
                    ? data.status === 'CANCELLED'
                      ? 'Sự kiện đã hủy, không nhận đăng ký.'
                      : 'Sự kiện đã kết thúc, không nhận đăng ký.'
                    : registration === 'guests_off'
                      ? 'Sự kiện này chỉ nhận đăng ký của thành viên APC.'
                      : registration === 'not_open'
                        ? `Đăng ký mở vào ${formatDateTime(data.registrationOpensAt ?? data.startAt)}.`
                        : `Đã hết hạn đăng ký${data.registrationClosesAt ? ` từ ${formatDateTime(data.registrationClosesAt)}` : ''}.`}
                </p>
                <div>
                  <Link to={`/events/${slug}`} className="inline-flex">
                    <Button variant="outline">← Về trang sự kiện</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form
                data-rv
                className="flex max-w-[64ch] flex-col gap-6"
                onSubmit={handleSubmit}
                noValidate
                aria-busy={submitting}
              >
                <p className="font-code text-[16px] font-bold text-apc-blue">{'// thông tin đăng ký'}</p>
                <label className={labelClass}>
                  họ và tên
                  <input
                    className={inputClass}
                    name="fullName"
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={fullName}
                    onChange={(formEvent) => setFullName(formEvent.target.value)}
                    disabled={submitting}
                    aria-invalid={Boolean(fields.fullName)}
                  />
                  {errorText('fullName')}
                </label>
                <label className={labelClass}>
                  email
                  <input
                    className={inputClass}
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={120}
                    value={email}
                    onChange={(formEvent) => setEmail(formEvent.target.value)}
                    disabled={submitting}
                    aria-invalid={Boolean(fields.email)}
                  />
                  {errorText('email')}
                </label>
                <label className={labelClass}>
                  mã số sinh viên
                  <input
                    className={inputClass}
                    name="studentId"
                    autoComplete="off"
                    required
                    maxLength={20}
                    value={studentId}
                    onChange={(formEvent) => setStudentId(formEvent.target.value)}
                    disabled={submitting}
                    aria-invalid={Boolean(fields.studentId)}
                  />
                  {errorText('studentId')}
                </label>
                <label className="flex max-w-[56ch] items-start gap-3 text-[16px] leading-relaxed">
                  <input
                    type="checkbox"
                    name="consent"
                    required
                    checked={consent}
                    onChange={(formEvent) => setConsent(formEvent.target.checked)}
                    disabled={submitting}
                    aria-invalid={Boolean(fields.consent)}
                    className="mt-1 size-5 shrink-0 accent-apc-red"
                  />
                  <span>
                    Tôi đồng ý cho CLB APC xử lý dữ liệu cá nhân nêu trên nhằm phục vụ quản lý đăng ký sự kiện, theo{' '}
                    <Link to="/privacy" className="text-apc-blue underline decoration-2 underline-offset-4">
                      chính sách quyền riêng tư
                    </Link>
                    .
                  </span>
                </label>
                {errorText('consent')}

                {submit.phase === 'error' && Object.keys(fields).length === 0 && (
                  <p role="alert" className="rounded-xl bg-apc-red-pale px-4 py-3 text-[16px] font-bold text-apc-red">
                    {submit.message}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4">
                  {/* Chưa tick ô đồng ý thì không gửi được form (FLOW-14) */}
                  <Button type="submit" disabled={!consent || submitting}>
                    {submitting ? 'đang gửi' : 'Đăng ký tham gia →'}
                  </Button>
                  <Link to={`/events/${slug}`} className="font-code text-[15px] font-bold text-muted underline decoration-2 underline-offset-4">
                    Hủy, về trang sự kiện
                  </Link>
                </div>
              </form>
            )}
          </div>

          {/* Cột phải: tóm tắt sự kiện và thời gian nhận đăng ký */}
          <aside data-rv style={delay(90)} className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
            <dl className="rounded-[20px] bg-soft p-6">
              <div className="border-b-2 border-ink/10 py-3 first:pt-0">
                <dt className="font-code text-[13px] font-bold text-muted">thời gian</dt>
                <dd className="mt-0.5 text-[16px] font-bold">
                  {formatDate(data.startAt)} · {formatDateTime(data.startAt)} – {formatDateTime(data.endAt)}
                </dd>
              </div>
              <div className="border-b-2 border-ink/10 py-3">
                <dt className="font-code text-[13px] font-bold text-muted">{data.location ? 'địa điểm' : 'hình thức'}</dt>
                <dd className="mt-0.5 text-[16px] font-bold">{data.location ?? 'Trực tuyến'}</dd>
              </div>
              <div className="border-b-2 border-ink/10 py-3">
                <dt className="font-code text-[13px] font-bold text-muted">ban tổ chức</dt>
                <dd className="mt-0.5 text-[16px] font-bold">{data.departmentName ?? 'CLB APC'}</dd>
              </div>
              <div className="py-3 last:pb-0">
                <dt className="font-code text-[13px] font-bold text-muted">nhận đăng ký</dt>
                <dd className="mt-0.5 text-[16px] font-bold">
                  {data.registrationOpensAt ? formatDate(data.registrationOpensAt) : '—'} →{' '}
                  {data.registrationClosesAt ? formatDateTime(data.registrationClosesAt) : '—'}
                </dd>
              </div>
            </dl>
            <p className="max-w-[40ch] px-2 text-[15px] leading-relaxed text-muted">
              Không cần tài khoản APC. Sau khi đăng ký, bạn nhận mã đăng ký để tra cứu hoặc hủy.
            </p>
          </aside>
        </div>
      </section>
    </main>
  )
}

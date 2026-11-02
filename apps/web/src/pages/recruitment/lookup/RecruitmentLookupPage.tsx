import { type CSSProperties, type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { Button } from '../../../components/Button'
import { inputClass, labelClass } from '../../../components/formClass'
import { PageHero } from '../../../components/PageHero'
import { Seo } from '../../../components/Seo'
import { api, ApiError } from '../../../lib/api'
import { formatDateTime } from '../../../lib/format'
import type { ApplicationStatus, LookupApplicationResult } from '../types'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

const STATUS_DETAILS: Record<ApplicationStatus, { label: string; badgeClass: string; desc: string }> = {
  NEW: {
    label: 'Mới nộp',
    badgeClass: 'bg-paper text-ink font-bold',
    desc: 'Hồ sơ của bạn đã được ghi nhận thành công và đang chờ ban chuyên môn xếp lịch duyệt.',
  },
  REVIEWING: {
    label: 'Đang xét duyệt',
    badgeClass: 'bg-apc-blue-pale text-apc-blue font-bold',
    desc: 'Ban chuyên môn đang tiến hành đánh giá hồ sơ và các câu hỏi nghiệp vụ của bạn.',
  },
  INTERVIEW: {
    label: 'Mời phỏng vấn',
    badgeClass: 'bg-ink text-paper font-bold',
    desc: 'Chúc mừng bạn! Hồ sơ của bạn đã vượt qua vòng lọc và được mời phỏng vấn. Vui lòng kiểm tra email thường xuyên để nhận thông tin phòng họp.',
  },
  ACCEPTED: {
    label: 'Đã chấp nhận',
    badgeClass: 'bg-ink text-paper font-bold',
    desc: 'Chúc mừng bạn đã trúng tuyển vào CLB APC! Ban Chủ nhiệm sẽ liên hệ với bạn để thông báo các bước tiếp theo.',
  },
  REJECTED: {
    label: 'Không chấp nhận',
    badgeClass: 'bg-apc-red-pale text-apc-red font-bold',
    desc: 'Cảm ơn bạn đã quan tâm và dành thời gian ứng tuyển vào APC. Rất tiếc hồ sơ của bạn chưa được chấp nhận trong đợt tuyển này.',
  },
  WITHDRAWN: {
    label: 'Đã rút đơn',
    badgeClass: 'bg-paper text-muted font-bold',
    desc: 'Hồ sơ này đã được rút theo yêu cầu của ứng viên và không còn tham gia xét tuyển.',
  },
}

export function RecruitmentLookupPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [result, setResult] = useState<LookupApplicationResult | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  async function performLookup(targetEmail: string, targetCode: string) {
    return api<LookupApplicationResult>('/public/applications/lookup', {
      method: 'POST',
      body: { email: targetEmail.trim(), code: targetCode.trim() },
    })
  }

  async function handleLookup(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setConfirming(false)
    setLoading(true)

    try {
      const res = await performLookup(email, code)
      setResult(res)
    } catch (err) {
      setResult(null)
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Không thể tra cứu hồ sơ. Vui lòng thử lại sau.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleWithdraw() {
    if (!result) return
    setWithdrawing(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const targetEmail = email.trim()
    const targetCode = (code.trim() || result.profileCode).trim()

    try {
      const res = await api<{ success: boolean; status: ApplicationStatus; updatedAt: string }>(
        '/public/applications/withdraw',
        {
          method: 'POST',
          body: { email: targetEmail, code: targetCode },
        },
      )
      setResult({
        ...result,
        status: res.status ?? 'WITHDRAWN',
        canWithdraw: false,
        updatedAt: res.updatedAt,
      })
      setConfirming(false)
      setSuccessMessage('Đã rút hồ sơ ứng tuyển thành công. Một email xác nhận đã được gửi đến bạn.')
    } catch (err) {
      setConfirming(false)
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
        if (err.status === 409) {
          // Trạng thái hồ sơ đã thay đổi (hoặc đã được rút / duyệt trước đó - BR-16)
          // Tự động tra cứu lại từ máy chủ để hiển thị trạng thái mới nhất và ẩn nút rút đơn
          try {
            const fresh = await performLookup(targetEmail, targetCode)
            setResult(fresh)
          } catch {
            // Giữ nguyên thông báo lỗi nếu tra cứu lại gặp sự cố mạng
          }
        }
      } else {
        setErrorMessage('Không thể rút hồ sơ lúc này. Vui lòng thử lại sau.')
      }
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <main>
      <Seo title="Tra cứu hồ sơ ứng tuyển" path="/recruitment/application-lookup" robots="noindex, nofollow" />
      <PageHero
        tone="blue"
        comment="tra cứu hồ sơ"
        title="Tra cứu & Rút hồ sơ ứng tuyển"
        lede="Nhập địa chỉ email và mã hồ sơ đã được cấp khi bạn nộp đơn để kiểm tra tiến trình xét duyệt."
        top={
          <Breadcrumb
            items={[
              { label: 'trang chủ', to: '/' },
              { label: 'tuyển thành viên', to: '/recruitment' },
              { label: 'tra cứu hồ sơ' },
            ]}
          />
        }
      />

      <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
        <div className="mx-auto grid w-full max-w-container-max gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-16">
          {/* Form tra cứu */}
          <form
            data-rv
            className="flex max-w-[56ch] flex-col gap-6"
            onSubmit={handleLookup}
            noValidate
            aria-busy={loading}
          >
            <p className="font-code text-[16px] font-bold text-apc-blue">{'// thông tin tra cứu'}</p>
            <label className={labelClass}>
              địa chỉ email đã nộp đơn *
              <input
                className={inputClass}
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vd: nguyenvana@example.com"
                disabled={loading || withdrawing}
              />
            </label>

            <label className={labelClass}>
              mã hồ sơ (Profile Code) *
              <input
                className={`${inputClass} font-code tracking-[0.12em] uppercase`}
                name="code"
                type="text"
                autoComplete="off"
                required
                maxLength={32}
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="vd: mã gồm các chữ và số"
                disabled={loading || withdrawing}
              />
            </label>

            {errorMessage && (
              <p role="alert" className="rounded-xl bg-apc-red-pale px-4 py-3 text-[16px] font-bold text-apc-red">
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p role="status" className="rounded-xl bg-soft px-4 py-3 text-[16px] font-bold text-ink">
                {successMessage}
              </p>
            )}

            <div>
              <Button type="submit" disabled={loading || withdrawing}>
                {loading ? 'đang kiểm tra…' : 'Tra cứu hồ sơ'}
              </Button>
            </div>

            <p className="max-w-[48ch] text-[15px] leading-relaxed text-muted">
              Sai email hoặc sai mã nhiều lần trong 15 phút sẽ bị tạm chặn. Nếu mất mã, hãy xem lại email xác nhận lúc nộp đơn.
            </p>
          </form>

          {/* Kết quả tra cứu */}
          <aside data-rv style={delay(90)} className="min-w-0" aria-live="polite">
            {result ? (
              <div className="flex flex-col gap-6">
                <div className="rounded-[20px] bg-soft p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-code text-[14px] font-bold text-muted">{'// kết quả tra cứu'}</p>
                    <span
                      className={`rounded-md px-2.5 py-1 font-code text-[13px] ${
                        STATUS_DETAILS[result.status]?.badgeClass ?? 'bg-paper text-ink'
                      }`}
                    >
                      {STATUS_DETAILS[result.status]?.label ?? result.status}
                    </span>
                  </div>

                  <h2 className="mt-3 font-display text-[clamp(22px,2.2vw,30px)] font-extrabold leading-tight text-ink">
                    {result.applicantName}
                  </h2>
                  <p className="mt-1 font-code text-sm text-muted">
                    Mã hồ sơ: <span className="font-bold text-apc-red">{result.profileCode}</span>
                  </p>

                  <div className="mt-4 rounded-xl bg-paper p-4">
                    <p className="font-body text-sm leading-relaxed text-ink">
                      {STATUS_DETAILS[result.status]?.desc}
                    </p>
                  </div>

                  <dl className="mt-4">
                    <div className="border-b-2 border-ink/10 py-3 first:pt-0">
                      <dt className="font-code text-[13px] font-bold text-muted">đợt tuyển</dt>
                      <dd className="mt-0.5 text-[16px] font-bold">
                        <Link
                          to={`/recruitment/${result.roundSlug}`}
                          className="text-ink hover:text-apc-blue hover:underline decoration-2 underline-offset-4"
                        >
                          {result.roundTitle}
                        </Link>
                      </dd>
                    </div>

                    <div className="border-b-2 border-ink/10 py-3">
                      <dt className="font-code text-[13px] font-bold text-muted">ban chuyên môn đăng ký</dt>
                      <dd className="mt-0.5 text-[16px] font-bold">{result.desiredDepartmentName}</dd>
                    </div>

                    <div className="border-b-2 border-ink/10 py-3">
                      <dt className="font-code text-[13px] font-bold text-muted">thời điểm nộp đơn</dt>
                      <dd className="mt-0.5 font-code text-[16px] font-bold">{formatDateTime(result.submittedAt)}</dd>
                    </div>

                    <div className="py-3 last:pb-0">
                      <dt className="font-code text-[13px] font-bold text-muted">cập nhật lần cuối</dt>
                      <dd className="mt-0.5 font-code text-[16px] font-bold">{formatDateTime(result.updatedAt)}</dd>
                    </div>
                  </dl>
                </div>

                {/* Hành động rút đơn (chỉ khi có thể rút) */}
                {result.canWithdraw && !confirming && (
                  <div>
                    <Button variant="outline" onClick={() => setConfirming(true)} disabled={withdrawing}>
                      Rút hồ sơ ứng tuyển
                    </Button>
                  </div>
                )}

                {/* Hộp xác nhận hành động nhạy cảm (STATE-07) */}
                {confirming && result.canWithdraw && (
                  <div className="rounded-[20px] bg-ink p-6 text-paper">
                    <p className="font-code text-[14px] font-bold text-apc-gold-soft">{'// xác nhận rút hồ sơ'}</p>
                    <p className="mt-3 text-[16px] leading-relaxed">
                      Bạn có chắc chắn muốn rút hồ sơ ứng tuyển của <b>{result.applicantName}</b> cho đợt <b>“{result.roundTitle}”</b>? Thao tác này không thể hoàn tác và hồ sơ sẽ dừng xét tuyển.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-4">
                      <Button variant="light" onClick={handleWithdraw} disabled={withdrawing}>
                        {withdrawing ? 'đang xử lý…' : 'Xác nhận rút hồ sơ'}
                      </Button>
                      <Button variant="outline" onClick={() => setConfirming(false)} disabled={withdrawing}>
                        Giữ hồ sơ
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div data-rv className="flex h-full flex-col justify-center gap-4 rounded-[20px] bg-soft p-8 text-muted">
                <p className="font-code text-[14px] font-bold">{'// hướng dẫn'}</p>
                <p className="max-w-[44ch] text-[17px] leading-relaxed">
                  Mã hồ sơ đã được cấp khi bạn gửi đơn ứng tuyển thành công (đồng thời gửi vào email của bạn). Sau khi tra cứu, bạn có thể theo dõi kết quả từng vòng hoặc rút đơn trước khi có kết quả cuối cùng.
                </p>
                <Link
                  to="/recruitment"
                  className="font-code text-[15px] font-bold text-apc-blue underline decoration-2 underline-offset-4"
                >
                  Xem các đợt tuyển đang mở →
                </Link>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  )
}

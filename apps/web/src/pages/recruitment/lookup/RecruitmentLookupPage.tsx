import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { api, ApiError } from '../../../lib/api'
import { formatDateTime } from '../../../lib/format'
import type { ApplicationStatus, LookupApplicationResult } from '../types'

const STATUS_DETAILS: Record<ApplicationStatus, { label: string; badgeClass: string; desc: string }> = {
  NEW: {
    label: 'Mới nộp',
    badgeClass: 'bg-soft text-ink font-bold',
    desc: 'Hồ sơ của bạn đã được ghi nhận thành công và đang chờ ban chuyên môn xếp lịch duyệt.',
  },
  REVIEWING: {
    label: 'Đang xét duyệt',
    badgeClass: 'bg-soft text-apc-blue font-bold',
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
    desc: 'Chúc mừng bạn đã chính thức trở thành thành viên của CLB APC! Ban Chủ nhiệm sẽ liên hệ và gửi thông tin tài khoản thành viên sớm.',
  },
  REJECTED: {
    label: 'Không phù hợp',
    badgeClass: 'bg-soft text-muted font-bold',
    desc: 'Cảm ơn bạn đã quan tâm và dành thời gian ứng tuyển vào APC. Rất tiếc hồ sơ lần này chưa phù hợp với tiêu chí của câu lạc bộ.',
  },
  WITHDRAWN: {
    label: 'Đã rút đơn',
    badgeClass: 'bg-soft text-muted opacity-60 font-bold',
    desc: 'Hồ sơ này đã được rút theo yêu cầu của ứng viên và không còn tham gia xét tuyển.',
  },
}

export function RecruitmentLookupPage() {
  // Gắn noindex, nofollow theo yêu cầu của phiếu R4
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'robots')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', 'noindex, nofollow')
  }, [])

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [result, setResult] = useState<LookupApplicationResult | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)

  async function handleLookup(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      const res = await api<LookupApplicationResult>('/public/applications/lookup', {
        method: 'POST',
        body: { email: email.trim(), code: code.trim() },
      })
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
    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn rút hồ sơ ứng tuyển này? Thao tác này không thể hoàn tác và hồ sơ sẽ dừng xét tuyển.',
    )
    if (!confirmed) return

    setWithdrawing(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await api<{ success: boolean; status: ApplicationStatus; updatedAt: string }>(
        '/public/applications/withdraw',
        {
          method: 'POST',
          body: { email: email.trim(), code: code.trim() },
        },
      )
      setResult({
        ...result,
        status: 'WITHDRAWN',
        canWithdraw: false,
        updatedAt: new Date().toISOString(),
      })
      setSuccessMessage('Đã rút hồ sơ ứng tuyển thành công. Một email xác nhận đã được gửi đến bạn.')
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Không thể rút hồ sơ lúc này. Vui lòng thử lại sau.')
      }
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-gutter py-10 md:py-14">
      <Breadcrumb
        items={[
          { label: 'trang chủ', to: '/' },
          { label: 'tuyển thành viên', to: '/recruitment' },
          { label: 'tra cứu hồ sơ' },
        ]}
      />

      <div className="mt-4">
        <Eyebrow className="text-apc-blue">tra cứu hồ sơ</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-ink md:text-4xl">
          Tra cứu & Rút hồ sơ ứng tuyển
        </h1>
        <p className="mt-2 font-body text-base text-muted">
          Nhập địa chỉ email và mã hồ sơ đã được cấp khi bạn nộp đơn để kiểm tra tiến trình xét duyệt.
        </p>
      </div>

      {/* Form tra cứu */}
      <form onSubmit={handleLookup} className="mt-8 rounded-xl border-2 border-ink bg-paper p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-code text-xs font-bold text-muted mb-1">
              Địa chỉ Email đã nộp đơn *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vd: nguyenvana@example.com"
              className="w-full rounded-xl border-2 border-ink bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none focus:border-apc-blue"
            />
          </div>

          <div>
            <label className="block font-code text-xs font-bold text-muted mb-1">
              Mã hồ sơ (Profile Code) *
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="vd: mã gồm các chữ và số"
              className="w-full rounded-xl border-2 border-ink bg-paper px-4 py-2.5 font-code text-sm text-ink outline-none focus:border-apc-blue"
            />
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Đang kiểm tra…' : 'Tra cứu hồ sơ'}
          </Button>
        </div>
      </form>

      {/* Thông báo lỗi */}
      {errorMessage && (
        <div className="mt-6 rounded-xl border-2 border-apc-red bg-apc-red-pale/40 p-4 font-body text-sm font-bold text-apc-red">
          {errorMessage}
        </div>
      )}

      {/* Thông báo thành công */}
      {successMessage && (
        <div className="mt-6 rounded-xl border-2 border-ink bg-soft p-4 font-body text-sm font-bold text-ink">
          {successMessage}
        </div>
      )}

      {/* Kết quả tra cứu */}
      {result && (
        <div className="mt-8 rounded-xl border-2 border-ink bg-paper p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-ink pb-4">
            <div>
              <span className="font-code text-xs font-bold uppercase text-muted">
                Hồ sơ ứng viên: <strong className="text-ink">{result.applicantName}</strong>
              </span>
              <p className="mt-1 font-code text-sm text-ink">
                Mã hồ sơ: <span className="font-bold text-apc-red">{result.profileCode}</span>
              </p>
            </div>

            <div>
              <span
                className={`inline-block rounded-md px-3 py-1 font-code text-xs ${
                  STATUS_DETAILS[result.status].badgeClass
                }`}
              >
                {STATUS_DETAILS[result.status].label}
              </span>
            </div>
          </div>

          <div className="rounded-xl border-2 border-ink/20 bg-soft p-4">
            <p className="font-body text-sm text-ink leading-relaxed">
              {STATUS_DETAILS[result.status].desc}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-body text-sm">
            <div className="rounded-xl border-2 border-ink/20 p-4">
              <span className="font-code text-xs font-bold text-muted uppercase">Đợt tuyển</span>
              <p className="mt-1 font-bold text-ink">
                <Link to={`/recruitment/${result.roundSlug}`} className="hover:text-apc-red underline">
                  {result.roundTitle}
                </Link>
              </p>
            </div>

            <div className="rounded-xl border-2 border-ink/20 p-4">
              <span className="font-code text-xs font-bold text-muted uppercase">Ban chuyên môn đăng ký</span>
              <p className="mt-1 font-bold text-ink">{result.desiredDepartmentName}</p>
            </div>

            <div className="rounded-xl border-2 border-ink/20 p-4">
              <span className="font-code text-xs font-bold text-muted uppercase">Thời điểm nộp đơn</span>
              <p className="mt-1 font-code text-ink">{formatDateTime(result.submittedAt)}</p>
            </div>

            <div className="rounded-xl border-2 border-ink/20 p-4">
              <span className="font-code text-xs font-bold text-muted uppercase">Cập nhật lần cuối</span>
              <p className="mt-1 font-code text-ink">{formatDateTime(result.updatedAt)}</p>
            </div>
          </div>

          {/* Hành động rút đơn (chỉ khi có thể rút) */}
          {result.canWithdraw && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t-2 border-ink pt-6">
              <div>
                <p className="font-display text-sm font-bold text-ink">Bạn muốn rút hồ sơ ứng tuyển?</p>
                <p className="font-body text-xs text-muted">
                  Bạn có thể rút đơn nếu không còn nhu cầu tham gia đợt tuyển này trước khi có kết quả cuối.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={withdrawing}
                onClick={handleWithdraw}
                className="!text-apc-red hover:!bg-apc-red-pale/30"
              >
                {withdrawing ? 'Đang xử lý…' : 'Rút hồ sơ ứng tuyển'}
              </Button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
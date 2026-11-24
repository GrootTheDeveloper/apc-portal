import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { inputClass, labelClass } from '../../../components/formClass'
import { useAuth } from '../../../hooks/useAuth'
import { api, ApiError } from '../../../lib/api'
import { RECOVERY_CODES_PATH } from '../../../lib/auth'

/** Bước 2 khi đăng nhập (FLOW-27): mã 6 số từ ứng dụng, hoặc một mã khôi phục (sau đó bắt buộc tạo bộ mới). */
export function TwoFactorChallengePage() {
  const navigate = useNavigate()
  const { refresh, logout } = useAuth()
  const [useRecovery, setUseRecovery] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api<{ requireRegenerate: boolean }>('/auth/two-factor/verify', { body: { code: code.trim() } })
      await refresh()
      navigate(res.requireRegenerate ? RECOVERY_CODES_PATH : '/portal', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError(useRecovery ? 'Mã khôi phục không đúng hoặc đã dùng.' : 'Mã 6 số không đúng hoặc đã dùng.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Xác thực thất bại, vui lòng thử lại.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4 py-16 md:py-24">
      <div className="flex flex-col gap-6 rounded-2xl bg-soft p-6 md:p-10">
        <div>
          <Eyebrow className="mb-2 text-apc-primary">Xác minh bảo mật</Eyebrow>
          <h1 className="font-heading text-2xl font-bold text-ink md:text-3xl">
            {useRecovery ? 'Nhập mã khôi phục' : 'Xác thực 2 lớp'}
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            {useRecovery
              ? 'Nhập một mã khôi phục đã lưu (dạng xxxx-xxxx). Dùng xong, bạn sẽ được yêu cầu tạo bộ mã mới.'
              : 'Mở ứng dụng xác thực trên điện thoại và nhập mã 6 số.'}
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-apc-red/10 px-4 py-3 text-[15px] font-bold text-apc-red">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-5">
          <label className={labelClass}>
            {useRecovery ? 'Mã khôi phục' : 'Mã xác thực 6 số'}
            <input
              autoFocus
              required
              autoComplete="one-time-code"
              inputMode={useRecovery ? 'text' : 'numeric'}
              maxLength={useRecovery ? 15 : 6}
              value={code}
              onChange={(e) => setCode(useRecovery ? e.target.value : e.target.value.replace(/\D/g, ''))}
              className={`${inputClass} text-center font-code ${useRecovery ? 'text-lg tracking-widest' : 'text-2xl tracking-[0.4em]'}`}
            />
          </label>
          <Button type="submit" disabled={loading || (useRecovery ? code.length < 8 : code.length !== 6)}>
            {loading ? 'Đang kiểm tra…' : 'Xác nhận đăng nhập'}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-3 text-center">
          <button
            type="button"
            onClick={() => {
              setUseRecovery(!useRecovery)
              setCode('')
              setError(null)
            }}
            className="font-code text-[13px] font-bold text-apc-primary hover:underline"
          >
            {useRecovery ? '← Quay lại nhập mã 6 số' : 'Không có điện thoại? Dùng mã khôi phục'}
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="font-code text-[13px] text-muted hover:text-ink hover:underline"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </main>
  )
}

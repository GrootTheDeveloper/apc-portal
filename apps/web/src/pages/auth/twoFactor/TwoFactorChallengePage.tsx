import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { useAuth } from '../../../hooks/useAuth'
import { api, ApiError } from '../../../lib/api'

export function TwoFactorChallengePage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [useRecovery, setUseRecovery] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleVerifySubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await api<{ success: boolean; method: string; requireRegenerate?: boolean }>('/auth/two-factor/verify', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      })

      if (res.requireRegenerate) {
        // Dùng mã khôi phục xong phải chuyển tới màn hình bảo mật để tạo lại bộ mã mới (FLOW-27)
        navigate('/portal/account/security', { replace: true })
      } else {
        // Xác thực thành công -> vào trang quản trị hoặc portal
        window.location.href = '/portal'
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(useRecovery ? 'Mã khôi phục không hợp lệ hoặc đã qua sử dụng.' : 'Mã xác thực 6 số không chính xác hoặc đã qua sử dụng.')
      } else {
        setError(err instanceof Error ? err.message : 'Xác thực thất bại.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4 py-16 md:py-24">
      <div className="rounded-2xl border-2 border-ink bg-paper p-6 md:p-10 shadow-[4px_4px_0_0_#081F3D]">
        <Eyebrow className="mb-2 text-apc-primary">Xác minh bảo mật</Eyebrow>
        <h1 className="font-heading text-2xl font-bold text-ink md:text-3xl">
          {useRecovery ? 'Nhập mã khôi phục' : 'Xác thực hai bước'}
        </h1>
        <p className="mt-2 text-sm text-ink/75">
          {useRecovery
            ? 'Nhập một trong các mã khôi phục 8 ký tự bạn đã lưu (ví dụ: a3f8-k9x2).'
            : 'Mở ứng dụng xác thực (Google Authenticator) trên điện thoại và nhập mã 6 số.'}
        </p>

        {error && (
          <div className="mt-6 rounded-xl border-2 border-apc-red bg-apc-red/10 p-4 text-sm font-semibold text-apc-red">
            {error}
          </div>
        )}

        <form onSubmit={handleVerifySubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="challenge-code" className="block font-code text-xs font-bold uppercase tracking-wider text-ink">
              {useRecovery ? 'Mã khôi phục dự phòng' : 'Mã xác thực 6 số'}
            </label>
            <input
              id="challenge-code"
              type="text"
              autoFocus
              required
              inputMode={useRecovery ? 'text' : 'numeric'}
              maxLength={useRecovery ? 15 : 6}
              value={code}
              onChange={(e) => {
                const val = e.target.value
                setCode(useRecovery ? val : val.replace(/\D/g, ''))
              }}
              placeholder={useRecovery ? 'xxxx-xxxx' : '000000'}
              className={`mt-2 w-full rounded-xl bg-paper px-4 py-3 text-center font-code font-bold text-ink shadow-[inset_0_0_0_2px_#081F3D] outline-none focus:shadow-[inset_0_0_0_2px_#1568C9,0_0_0_4px_rgba(21,104,201,0.2)] ${
                useRecovery ? 'text-lg tracking-widest' : 'text-3xl tracking-[0.4em]'
              }`}
            />
          </div>

          <Button
            type="submit"
            disabled={loading || (useRecovery ? code.length < 8 : code.length !== 6)}
            className="w-full"
          >
            {loading ? 'Đang kiểm tra...' : 'Xác nhận đăng nhập'}
          </Button>

          <div className="flex flex-col items-center gap-3 pt-2 text-center">
            <button
              type="button"
              onClick={() => {
                setUseRecovery(!useRecovery)
                setCode('')
                setError(null)
              }}
              className="font-code text-xs font-bold text-apc-primary hover:underline"
            >
              {useRecovery ? '← Quay lại nhập mã 6 số từ ứng dụng' : 'Không mang điện thoại? Dùng mã khôi phục dự phòng'}
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="font-code text-xs text-ink/60 hover:text-ink hover:underline"
            >
              Đăng xuất và đổi tài khoản khác
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

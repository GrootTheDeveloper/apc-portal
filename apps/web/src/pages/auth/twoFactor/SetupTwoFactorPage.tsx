import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { api, ApiError } from '../../../lib/api'

type Step = 'password' | 'scan_qr'

export function SetupTwoFactorPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await api<{ qrCodeDataUrl: string; manualKey: string }>('/auth/two-factor/setup', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      setQrCode(res.qrCodeDataUrl)
      setManualKey(res.manualKey)
      setStep('scan_qr')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Mật khẩu không chính xác.')
      } else {
        setError(err instanceof Error ? err.message : 'Có lỗi xảy ra, vui lòng thử lại.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await api<{ recoveryCodes: string[] }>('/auth/two-factor/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: totpCode.trim() }),
      })
      // Lưu tạm mã khôi phục vào sessionStorage chỉ để trang kế tiếp hiển thị 1 lần
      sessionStorage.setItem('apc_temp_recovery_codes', JSON.stringify(res.recoveryCodes))
      navigate('/account/recovery-codes', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError('Mã xác thực 6 số không chính xác hoặc đã hết hạn.')
      } else {
        setError(err instanceof Error ? err.message : 'Xác thực thất bại.')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleCopyKey() {
    navigator.clipboard.writeText(manualKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="mx-auto max-w-[560px] px-4 py-12 md:py-20">
      <div className="rounded-2xl border-2 border-ink bg-paper p-6 md:p-10 shadow-[4px_4px_0_0_#081F3D]">
        <Eyebrow className="mb-2 text-apc-primary">Bảo mật tài khoản đặc quyền</Eyebrow>
        <h1 className="font-heading text-2xl font-bold text-ink md:text-3xl">
          Thiết lập xác thực 2 lớp (TOTP)
        </h1>
        <p className="mt-2 text-sm text-ink/75">
          Tài khoản Ban Chủ nhiệm và Quản trị viên kỹ thuật cần bảo vệ bằng mã xác thực 2 bước
          để kích hoạt quyền hạn quản trị (RP-13, FLOW-27).
        </p>

        {error && (
          <div className="mt-6 rounded-xl border-2 border-apc-red bg-apc-red/10 p-4 text-sm font-semibold text-apc-red">
            {error}
          </div>
        )}

        {step === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="pwd" className="block font-code text-xs font-bold uppercase tracking-wider text-ink">
                Nhập lại mật khẩu để tiếp tục
              </label>
              <input
                id="pwd"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu của bạn..."
                className="mt-2 w-full rounded-xl bg-paper px-4 py-3 text-base text-ink shadow-[inset_0_0_0_2px_#081F3D] outline-none focus:shadow-[inset_0_0_0_2px_#1568C9,0_0_0_4px_rgba(21,104,201,0.2)]"
              />
            </div>
            <Button type="submit" disabled={loading || !password} className="w-full">
              {loading ? 'Đang xác thực...' : 'Tiếp tục thiết lập'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleConfirmSubmit} className="mt-8 space-y-6">
            <div className="flex flex-col items-center justify-center rounded-xl border border-ink/20 bg-ink/5 p-4">
              <img
                src={qrCode}
                alt="Mã QR thiết lập TOTP"
                className="h-56 w-56 rounded-lg border-2 border-ink bg-white p-2"
              />
              <p className="mt-3 text-center text-xs text-ink/70">
                Dùng ứng dụng Google Authenticator hoặc Microsoft Authenticator để quét mã trên
              </p>
            </div>

            <div>
              <span className="block font-code text-xs font-bold uppercase tracking-wider text-ink">
                Hoặc nhập khóa bảo mật thủ công:
              </span>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border-2 border-ink bg-ink/5 px-4 py-2.5">
                <code className="font-code text-sm font-bold tracking-wider text-apc-primary break-all">
                  {manualKey}
                </code>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="shrink-0 font-code text-xs font-bold text-ink hover:text-apc-primary"
                >
                  {copied ? '✓ Đã chép' : 'Sao chép'}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="totp" className="block font-code text-xs font-bold uppercase tracking-wider text-ink">
                Nhập mã 6 số từ ứng dụng để xác nhận:
              </label>
              <input
                id="totp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="mt-2 w-full rounded-xl bg-paper px-4 py-3 text-center font-code text-2xl font-bold tracking-[0.4em] text-ink shadow-[inset_0_0_0_2px_#081F3D] outline-none focus:shadow-[inset_0_0_0_2px_#1568C9,0_0_0_4px_rgba(21,104,201,0.2)]"
              />
            </div>

            <Button type="submit" disabled={loading || totpCode.length !== 6} className="w-full">
              {loading ? 'Đang kích hoạt...' : 'Xác nhận & Kích hoạt'}
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}

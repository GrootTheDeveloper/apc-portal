import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { inputClass, labelClass } from '../../../components/formClass'
import { useAuth } from '../../../hooks/useAuth'
import { api, ApiError } from '../../../lib/api'
import { RECOVERY_CODES_PATH } from '../../../lib/auth'

type Setup = { qrCodeDataUrl: string; manualKey: string }

/** Thiết lập 2 lớp (FLOW-27): nhập lại mật khẩu → quét QR → nhập mã 6 số đầu tiên → xem mã khôi phục một lần. */
export function SetupTwoFactorPage() {
  const navigate = useNavigate()
  const { refresh, logout } = useAuth()
  const [password, setPassword] = useState('')
  const [setup, setSetup] = useState<Setup | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>, messages: Record<number, string>) {
    setError(null)
    setLoading(true)
    try {
      await action()
    } catch (err) {
      setError(err instanceof ApiError ? (messages[err.status] ?? err.message) : 'Có lỗi xảy ra, vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  function start(e: FormEvent) {
    e.preventDefault()
    void run(async () => setSetup(await api<Setup>('/auth/two-factor/setup', { body: { password } })), {
      401: 'Mật khẩu không chính xác.',
    })
  }

  function confirm(e: FormEvent) {
    e.preventDefault()
    void run(
      async () => {
        const { recoveryCodes } = await api<{ recoveryCodes: string[] }>('/auth/two-factor/confirm', { body: { code } })
        await refresh()
        // Mã khôi phục chỉ đi qua state của router: tải lại trang là mất, không lưu vào trình duyệt.
        navigate(RECOVERY_CODES_PATH, { replace: true, state: { recoveryCodes } })
      },
      { 422: 'Mã 6 số không đúng hoặc đã hết hạn.' },
    )
  }

  return (
    <main className="mx-auto max-w-[560px] px-4 py-12 md:py-20">
      <div className="flex flex-col gap-6 rounded-2xl bg-soft p-6 md:p-10">
        <div>
          <Eyebrow className="mb-2 text-apc-primary">Bảo mật tài khoản đặc quyền</Eyebrow>
          <h1 className="font-heading text-2xl font-bold text-ink md:text-3xl">Thiết lập xác thực 2 lớp</h1>
          <p className="mt-2 text-[15px] text-muted">
            Tài khoản Ban Chủ nhiệm và Quản trị kỹ thuật cần mã 2 lớp trước khi dùng quyền quản trị.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-apc-red/10 px-4 py-3 text-[15px] font-bold text-apc-red">
            {error}
          </p>
        )}

        {!setup ? (
          <form onSubmit={start} className="flex flex-col gap-5">
            <label className={labelClass}>
              Nhập lại mật khẩu để tiếp tục
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            <Button type="submit" disabled={loading || !password}>
              {loading ? 'Đang kiểm tra…' : 'Tiếp tục'}
            </Button>
          </form>
        ) : (
          <form onSubmit={confirm} className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3 rounded-xl bg-paper p-4">
              <img src={setup.qrCodeDataUrl} alt="Mã QR thiết lập xác thực 2 lớp" className="h-56 w-56" />
              <p className="text-center text-[14px] text-muted">Quét bằng Google Authenticator hoặc Microsoft Authenticator.</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-code text-[13px] font-bold">Hoặc nhập khóa thủ công</span>
              <code className="break-all rounded-xl bg-paper px-4 py-3 font-code text-[15px] font-bold tracking-wider text-apc-primary">
                {setup.manualKey}
              </code>
            </div>
            <label className={labelClass}>
              Mã 6 số trong ứng dụng
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={`${inputClass} text-center font-code text-2xl tracking-[0.4em]`}
              />
            </label>
            <Button type="submit" disabled={loading || code.length !== 6}>
              {loading ? 'Đang kích hoạt…' : 'Xác nhận và kích hoạt'}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => void logout()}
          className="self-center font-code text-[13px] text-muted hover:text-ink hover:underline"
        >
          Đăng xuất
        </button>
      </div>
    </main>
  )
}

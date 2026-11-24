import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { inputClass, labelClass } from '../../../components/formClass'
import { useAuth } from '../../../hooks/useAuth'
import { api, ApiError } from '../../../lib/api'

/**
 * Mã khôi phục (FLOW-27, SEC-12). Mã chỉ nằm trong bộ nhớ trang: đến từ state của router (vừa thiết lập) hoặc từ
 * lần tạo lại ngay trên trang này; tải lại trang là không xem lại được. Vừa đăng nhập bằng mã khôi phục
 * (`twoFactor = regenerate`) thì phải tạo bộ mới mới đi tiếp được.
 */
export function RecoveryCodesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const [codes, setCodes] = useState<string[]>(
    () => (location.state as { recoveryCodes?: string[] } | null)?.recoveryCodes ?? [],
  )
  const [password, setPassword] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Xóa mã khỏi lịch sử trình duyệt ngay khi đã đọc vào state của trang.
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  async function regenerate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api<{ recoveryCodes: string[] }>('/auth/two-factor/recovery-codes', { body: { password } })
      setPassword('')
      setCodes(res.recoveryCodes)
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 422 ? 'Mật khẩu không chính xác.' : 'Không tạo được bộ mã mới, vui lòng thử lại.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function finish() {
    await refresh()
    navigate('/portal', { replace: true })
  }

  const mustRegenerate = user?.twoFactor === 'regenerate'
  const title = codes.length > 0 ? 'Lưu 10 mã khôi phục' : mustRegenerate ? 'Tạo bộ mã khôi phục mới' : 'Mã khôi phục'
  const intro =
    codes.length > 0
      ? 'Mất điện thoại thì dùng một mã để đăng nhập. Mỗi mã dùng một lần. Mã chỉ hiện một lần này.'
      : mustRegenerate
        ? 'Bạn vừa đăng nhập bằng mã khôi phục nên bộ mã cũ đã hết hiệu lực. Nhập mật khẩu để tạo bộ mới.'
        : 'Mã khôi phục chỉ hiện một lần ngay sau khi tạo, tải lại trang không xem lại được.'

  return (
    <main className="mx-auto max-w-[560px] px-4 py-12 md:py-20">
      <div className="flex flex-col gap-6 rounded-2xl bg-soft p-6 md:p-10">
        <div>
          <Eyebrow className="mb-2 text-apc-primary">Mã khôi phục</Eyebrow>
          <h1 className="font-heading text-2xl font-bold text-ink md:text-3xl">{title}</h1>
          <p className="mt-2 text-[15px] text-muted">{intro}</p>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-apc-red/10 px-4 py-3 text-[15px] font-bold text-apc-red">
            {error}
          </p>
        )}

        {codes.length > 0 ? (
          <>
            <ol className="grid grid-cols-2 gap-3 rounded-xl bg-paper p-4">
              {codes.map((code) => (
                <li key={code} className="text-center font-code text-[15px] font-bold tracking-wider text-ink">
                  {code}
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(codes.join('\n'))}
              className="self-center font-code text-[13px] font-bold text-apc-primary hover:underline"
            >
              Sao chép cả 10 mã
            </button>
            <label className="flex items-start gap-3 text-[15px] font-bold text-ink">
              <input
                type="checkbox"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
                className="mt-1 h-5 w-5 accent-apc-primary"
              />
              Tôi đã lưu 10 mã này ở nơi an toàn.
            </label>
            <Button type="button" disabled={!saved} onClick={() => void finish()}>
              Hoàn tất
            </Button>
          </>
        ) : mustRegenerate ? (
          <form onSubmit={regenerate} className="flex flex-col gap-5">
            <label className={labelClass}>
              Mật khẩu hiện tại
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
              {loading ? 'Đang tạo…' : 'Tạo bộ mã mới'}
            </Button>
          </form>
        ) : (
          <Link to="/portal" className="self-center font-code text-[13px] font-bold text-apc-primary hover:underline">
            Về trang thành viên
          </Link>
        )}
      </div>
    </main>
  )
}

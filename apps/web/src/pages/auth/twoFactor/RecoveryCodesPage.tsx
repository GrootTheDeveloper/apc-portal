import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'

export function RecoveryCodesPage() {
  const navigate = useNavigate()
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)

  // Đọc mã từ sessionStorage lưu tạm
  const rawCodes = typeof window !== 'undefined' ? sessionStorage.getItem('apc_temp_recovery_codes') : null
  const codes: string[] = rawCodes ? JSON.parse(rawCodes) : []

  function handleCopyAll() {
    navigator.clipboard.writeText(codes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleComplete() {
    sessionStorage.removeItem('apc_temp_recovery_codes')
    navigate('/login', { replace: true })
  }

  if (codes.length === 0) {
    return (
      <main className="mx-auto max-w-[560px] px-4 py-16 text-center">
        <div className="rounded-2xl border-2 border-ink bg-paper p-8 shadow-[4px_4px_0_0_#081F3D]">
          <h1 className="font-heading text-2xl font-bold text-ink">Mã khôi phục không khả dụng</h1>
          <p className="mt-4 text-sm text-ink/75">
            Mã khôi phục chỉ được hiển thị **MỘT LẦN DUY NHẤT** ngay sau khi kích hoạt hoặc tạo lại.
            Nếu bạn tải lại trang, vì lý do an toàn, hệ thống sẽ không hiển thị lại mã.
          </p>
          <div className="mt-8">
            <Link to="/login" className="font-code text-sm font-bold text-apc-primary hover:underline">
              ← Quay lại trang đăng nhập
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[560px] px-4 py-12 md:py-20">
      <div className="rounded-2xl border-2 border-ink bg-paper p-6 md:p-10 shadow-[4px_4px_0_0_#081F3D]">
        <Eyebrow className="mb-2 text-apc-gold">Lưu ý bảo mật quan trọng</Eyebrow>
        <h1 className="font-heading text-2xl font-bold text-ink md:text-3xl">
          Mã khôi phục tài khoản
        </h1>
        <p className="mt-2 text-sm text-ink/75">
          Nếu mất điện thoại hoặc không truy cập được ứng dụng Authenticator, bạn có thể dùng một trong
          các mã này để đăng nhập. Mỗi mã chỉ dùng được đúng một lần (SEC-12, FLOW-27).
        </p>

        <div className="mt-6 rounded-xl border-2 border-apc-gold bg-apc-gold/10 p-4 text-xs font-semibold text-ink">
          ⚠️ Bộ mã này chỉ hiển thị <strong>MỘT LẦN DUY NHẤT</strong>. Tải lại trang sẽ không thể xem lại.
        </div>

        <div className="mt-6 rounded-xl border-2 border-ink bg-ink/5 p-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            {codes.map((code, index) => (
              <div
                key={code}
                className="rounded-lg border border-ink/20 bg-paper py-2 font-code text-sm font-bold tracking-wider text-ink shadow-[2px_2px_0_0_#081F3D]"
              >
                <span className="mr-2 text-xs font-normal text-ink/40">#{index + 1}</span>
                {code}
              </div>
            ))}
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleCopyAll}
              className="font-code text-xs font-bold text-apc-primary hover:underline"
            >
              {copied ? '✓ Đã sao chép 10 mã vào bộ nhớ tạm' : '📋 Sao chép toàn bộ 10 mã'}
            </button>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-2 border-ink accent-apc-primary"
            />
            <span className="text-sm font-semibold text-ink">
              Tôi xác nhận đã lưu trữ 10 mã khôi phục này ở nơi an toàn.
            </span>
          </label>

          <Button
            type="button"
            disabled={!confirmed}
            onClick={handleComplete}
            className="w-full"
          >
            Hoàn tất & Đăng nhập lại
          </Button>
        </div>
      </div>
    </main>
  )
}

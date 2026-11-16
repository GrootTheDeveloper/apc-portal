import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { PasswordField } from '../../../components/PasswordField'
import { useAuth } from '../../../hooks/useAuth'
import { api, ApiError } from '../../../lib/api'
import { type Me, needsActivation } from '../../../lib/auth'
import { fieldErrors } from '../../../lib/formErrors'
import { PasswordRules } from '../PasswordRules'

type Submit = { phase: 'idle' | 'submitting' } | { phase: 'error'; message: string; fields: Record<string, string[]> }

/**
 * PAGE-AUTH-02 — FLOW-09: tài khoản chờ kích hoạt đổi mật khẩu tạm thành mật khẩu riêng.
 * Đây là trang duy nhất (cùng Đăng xuất) tài khoản đó được mở; xong thì vào /portal với phiên mới.
 */
export function ActivatePage() {
  const { user, setMe, logout } = useAuth()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submit, setSubmit] = useState<Submit>({ phase: 'idle' })

  // Đã kích hoạt (kể cả ngay sau khi gửi thành công): sang trang thành viên.
  if (user && !needsActivation(user)) return <Navigate to="/portal" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmit({ phase: 'submitting' })
    try {
      setMe(await api<Me>('/auth/activate', { body: { newPassword, confirmPassword } }))
    } catch (error) {
      const message =
        error instanceof ApiError && error.status !== 422 ? error.message : 'Mật khẩu mới chưa đạt điều kiện. Xem lỗi ở từng ô.'
      setSubmit({ phase: 'error', message, fields: fieldErrors(error) })
    }
  }

  const submitting = submit.phase === 'submitting'
  const fields = submit.phase === 'error' ? submit.fields : {}

  return (
    <main className="px-4 py-16 md:px-8">
      <div className="mx-auto w-full max-w-[560px]">
        <Eyebrow className="text-apc-blue">kích hoạt tài khoản</Eyebrow>
        <h1 className="mt-3 font-display text-[clamp(40px,5vw,64px)] font-extrabold leading-[0.95] tracking-[-0.035em]">
          Đặt mật khẩu của bạn
        </h1>
        <p className="mt-4 text-[18px] leading-relaxed text-muted">
          Xin chào {user?.fullName}. Bạn đang dùng mật khẩu tạm do Ban Chủ nhiệm cấp. Hãy đặt mật khẩu riêng để bắt đầu
          dùng Portal.
        </p>

        <div className="mt-8">
          <PasswordRules extra="Khác mật khẩu tạm thời." />
        </div>

        <form className="mt-8 flex flex-col gap-6" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          <PasswordField
            label="mật khẩu mới"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
            errors={fields.newPassword}
            disabled={submitting}
          />
          <PasswordField
            label="nhập lại mật khẩu mới"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            errors={fields.confirmPassword}
            disabled={submitting}
          />

          {submit.phase === 'error' && (
            <p role="alert" className="rounded-xl bg-apc-red/10 px-4 py-3 text-[15px] font-bold text-apc-red">
              {submit.message}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-3">
            <Button type="submit" disabled={submitting || !newPassword || !confirmPassword}>
              {submitting ? 'Đang lưu…' : 'Lưu và vào Portal →'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={async () => {
                navigate('/', { replace: true })
                await logout()
              }}
            >
              Đăng xuất
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}

import { type FormEvent, useState } from 'react'

import { Button } from '../../../../components/Button'
import { PasswordField } from '../../../../components/PasswordField'
import { api, ApiError } from '../../../../lib/api'
import { fieldErrors } from '../../../../lib/formErrors'
import { PasswordRules } from '../../../account/PasswordRules'

type Submit =
  | { phase: 'idle' | 'submitting' | 'done' }
  | { phase: 'error'; message: string; fields: Record<string, string[]> }

/** PAGE-MEM-16 — FLOW-10: đổi mật khẩu. Xong thì mọi thiết bị khác bị đăng xuất, thiết bị này giữ phiên. */
export function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submit, setSubmit] = useState<Submit>({ phase: 'idle' })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmit({ phase: 'submitting' })
    try {
      await api('/auth/change-password', { body: { currentPassword, newPassword, confirmPassword } })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSubmit({ phase: 'done' })
    } catch (error) {
      const message =
        error instanceof ApiError && error.status !== 422 ? error.message : 'Chưa đổi được mật khẩu. Xem lỗi ở từng ô.'
      setSubmit({ phase: 'error', message, fields: fieldErrors(error) })
    }
  }

  const submitting = submit.phase === 'submitting'
  const fields = submit.phase === 'error' ? submit.fields : {}

  return (
    <main>
      <h1 className="font-display text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-[-0.03em]">
        Bảo mật tài khoản
      </h1>

      <section aria-labelledby="change-password" className="mt-10 max-w-[560px]">
        <h2 id="change-password" className="font-display text-[28px] font-extrabold tracking-[-0.02em]">
          Đổi mật khẩu
        </h2>
        <p className="mt-2 text-[17px] leading-relaxed text-muted">
          Sau khi đổi, các thiết bị khác đang đăng nhập sẽ bị đăng xuất; thiết bị này vẫn giữ đăng nhập.
        </p>

        <div className="mt-6">
          <PasswordRules extra="Khác mật khẩu hiện tại." />
        </div>

        <form className="mt-8 flex flex-col gap-6" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          <PasswordField
            label="mật khẩu hiện tại"
            name="currentPassword"
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            errors={fields.currentPassword}
            disabled={submitting}
          />
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
          {submit.phase === 'done' && (
            <p role="status" className="rounded-xl bg-apc-blue-pale px-4 py-3 text-[15px] font-bold text-apc-blue">
              Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.
            </p>
          )}

          <div>
            <Button type="submit" disabled={submitting || !currentPassword || !newPassword || !confirmPassword}>
              {submitting ? 'Đang lưu…' : 'Đổi mật khẩu'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

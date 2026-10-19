import { type FormEvent, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { useAuth } from '../../../hooks/useAuth'
import { ApiError } from '../../../lib/api'
import { safeReturnTo } from '../../../lib/returnTo'

type SubmitState = { phase: 'idle' } | { phase: 'submitting' } | { phase: 'error'; message: string }

const inputClass =
  'w-full rounded-apc border border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface outline-none transition-colors focus:border-apc-blue'

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
  if (error.status === 422) return 'Vui lòng nhập tên đăng nhập và mật khẩu.'
  // 401: "Sai tên đăng nhập hoặc mật khẩu." · 429: chờ 15 phút · network: không kết nối được máy chủ
  return error.message
}

/** PAGE-AUTH-01 — FLOW-09, FLOW-10. Không có tự đăng ký hay quên mật khẩu. */
export function LoginPage() {
  const { status, user, login } = useAuth()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submit, setSubmit] = useState<SubmitState>({ phase: 'idle' })

  // Đã đăng nhập (kể cả ngay sau khi bấm Đăng nhập): về trang đang định vào, mặc định /portal.
  if (status === 'authenticated' && user) {
    const destination = user.mustChangePassword ? '/account/activate' : safeReturnTo(searchParams.get('returnTo'))
    return <Navigate to={destination} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmit({ phase: 'submitting' })
    try {
      await login(username.trim(), password)
    } catch (error) {
      setPassword('')
      setSubmit({ phase: 'error', message: errorMessage(error) })
    }
  }

  const submitting = submit.phase === 'submitting'

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-container-max items-center justify-center px-gutter py-16">
      <AsyncState loading={status === 'loading'} empty={false}>
        <div className="w-full max-w-md rounded-apc border border-outline-variant bg-surface-container-lowest p-8">
          <Eyebrow>Thành viên APC</Eyebrow>
          <h1 className="mt-4 text-3xl font-bold text-on-surface">Đăng nhập</h1>

          <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
            <label className="flex flex-col gap-2 text-sm font-medium text-on-surface">
              Tên đăng nhập
              <input
                className={inputClass}
                name="username"
                autoComplete="username"
                required
                maxLength={100}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={submitting}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-on-surface">
              Mật khẩu
              <input
                className={inputClass}
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
              />
            </label>

            {submit.phase === 'error' && (
              <p role="alert" className="rounded-apc bg-primary-fixed px-4 py-3 text-sm text-apc-red">
                {submit.message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !username.trim() || !password}>
              {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </form>

          <p className="mt-6 text-sm text-on-surface-variant">Liên hệ Ban Chủ nhiệm để được cấp lại mật khẩu.</p>
        </div>
      </AsyncState>
    </main>
  )
}

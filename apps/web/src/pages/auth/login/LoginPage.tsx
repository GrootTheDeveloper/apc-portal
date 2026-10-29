import { type FormEvent, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { useAuth } from '../../../hooks/useAuth'
import { ApiError } from '../../../lib/api'
import { safeReturnTo } from '../../../lib/returnTo'
import { Eyebrow } from '../../../components/Eyebrow'

type SubmitState = { phase: 'idle' } | { phase: 'submitting' } | { phase: 'error'; message: string }

const MARK_PIECES = ['/assets/home/mark/mark-red.png', '/assets/home/mark/mark-gold.png', '/assets/home/mark/mark-blue.png']

// Viền 2px màu mực, focus đổi sang viền xanh kèm quầng (tín hiệu focus duy nhất của form, DESIGN.md).
const inputClass =
  'w-full rounded-xl bg-paper px-4 py-3 text-[17px] text-ink shadow-[inset_0_0_0_2px_#081F3D] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#1568C9,0_0_0_4px_rgba(21,104,201,0.2)] disabled:opacity-60'
const labelClass = 'flex flex-col gap-2 font-code text-[13px] font-bold'

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
    <main className="grid min-h-[calc(100svh-72px)] lg:grid-cols-2">
      <section className="hidden flex-col justify-between gap-10 bg-ink py-16 pr-14 text-paper lg:flex lg:pl-[max(32px,calc((100vw-1520px)/2+32px))]">
        <Eyebrow className="text-apc-gold-soft">
          portal thành viên
        </Eyebrow>
        <div aria-hidden className="mark-stack spread w-[min(46vh,380px)] self-center">
          {MARK_PIECES.map((src) => (
            <img key={src} alt="" src={src} />
          ))}
        </div>
        <p className="max-w-[18ch] font-display text-[clamp(32px,min(3.4vw,6vh),52px)] font-extrabold leading-[1.02] tracking-[-0.03em]">
          Một tài khoản cho mọi việc ở <span className="text-apc-gold">APC.</span>
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-16 md:px-8">
        <AsyncState loading={status === 'loading'} empty={false}>
          <div className="w-full max-w-[420px]">
            <Eyebrow className="text-apc-blue">
              thành viên apc
            </Eyebrow>
            <h1 className="mt-3 font-display text-[clamp(44px,5vw,72px)] font-extrabold leading-[0.95] tracking-[-0.035em]">Đăng nhập</h1>

            <form className="mt-10 flex flex-col gap-6" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
              <label className={labelClass}>
                tên đăng nhập
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
              <label className={labelClass}>
                mật khẩu
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
                <p role="alert" className="rounded-xl bg-apc-red/10 px-4 py-3 text-[15px] font-bold text-apc-red">
                  {submit.message}
                </p>
              )}

              <Button type="submit" className="mt-2 w-full" disabled={submitting || !username.trim() || !password}>
                {submitting ? 'Đang đăng nhập…' : 'Đăng nhập →'}
              </Button>
            </form>

            <p className="mt-8 border-t-2 border-ink/10 pt-5 text-[15px] text-muted">Quên mật khẩu thì nhắn Ban Chủ nhiệm để được cấp lại.</p>
          </div>
        </AsyncState>
      </section>
    </main>
  )
}

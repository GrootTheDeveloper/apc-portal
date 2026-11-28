import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { buttonClass } from './buttonClass.js'

// errorElement được react-router render không kèm children, nên children phải optional.
type RouteErrorBoundaryProps = { children?: ReactNode }
type RouteErrorBoundaryState = { hasError: boolean; errorId: string }

/** Chặn lỗi render của cả cây route (C6): hiện màn lỗi toàn trang thay vì màn hình trắng. */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false, errorId: '' }

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    // randomUUID có sẵn trên localhost/HTTPS; môi trường thiếu thì dùng chuỗi ngẫu nhiên tự ghép.
    const errorId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).substring(2)
    return { hasError: true, errorId }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route render error:', error, info)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children ?? null
    }
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="font-code text-[14px] font-bold text-apc-red">{'// lỗi giao diện'}</p>
        <h1 className="font-display text-[clamp(26px,3.2vw,40px)] font-bold leading-tight">Đã xảy ra lỗi giao diện</h1>
        <p className="max-w-[52ch]">Vui lòng gửi mã tham chiếu sau cho Ban Chủ nhiệm để được hỗ trợ:</p>
        <code className="inline-block rounded bg-ink px-4 py-2 font-code text-[14px] text-paper">
          Mã tham chiếu: {this.state.errorId}
        </code>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button onClick={() => window.location.reload()} className={buttonClass('primary')}>
            Tải lại trang
          </button>
          <Link to="/" className={buttonClass('outline')}>
            Về trang chủ
          </Link>
        </div>
      </main>
    )
  }
}
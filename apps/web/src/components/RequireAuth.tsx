import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { type GuardOptions, guardRedirect } from '../lib/auth'
import { loginUrl } from '../lib/returnTo'
import { Forbidden } from '../pages/Forbidden'
import { AsyncState } from './AsyncState'

type RequireAuthProps = GuardOptions & {
  /** trang 403 dạng gọn khi nằm trong khung portal/admin */
  compact?: boolean
  children: ReactNode
}

/**
 * Chặn route cần đăng nhập theo thứ tự Sitemap mục 11.1 (logic ở `guardRedirect`, src/lib/auth.ts).
 * Chỉ để điều hướng; API vẫn tự kiểm quyền mọi request.
 *   { path: 'admin', element: <RequireAuth roles={ADMIN_ROLES}><AdminLayout /></RequireAuth>, children: [...] }
 */
export function RequireAuth({ roles, gate, compact = false, children }: RequireAuthProps) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <main className="mx-auto max-w-container-max px-4 md:px-8">
        <AsyncState loading empty={false}>
          {null}
        </AsyncState>
      </main>
    )
  }
  const result = guardRedirect(user, { roles, gate })
  // Chưa đăng nhập hoặc phiên hết hạn/bị thu hồi → đăng nhập rồi quay lại đúng trang.
  if (result.action === 'login') return <Navigate to={loginUrl(`${location.pathname}${location.search}`)} replace />
  if (result.action === 'redirect') return <Navigate to={result.to} replace />
  if (result.action === 'forbidden') return <Forbidden compact={compact} />
  return <>{children}</>
}

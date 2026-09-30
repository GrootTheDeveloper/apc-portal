import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { hasAnyRole, type Role } from '../lib/auth'
import { loginUrl } from '../lib/returnTo'
import { Forbidden } from '../pages/Forbidden'
import { AsyncState } from './AsyncState'

/**
 * Chặn route cần đăng nhập (sitemap mục 11): chưa đăng nhập → /login?returnTo=…, sai vai trò → trang 403.
 * Chỉ để điều hướng; API vẫn tự kiểm quyền.
 *   { path: 'admin', element: <RequireAuth roles={ADMIN_ROLES}><Outlet /></RequireAuth>, children: [...] }
 */
export function RequireAuth({ roles, children }: { roles?: readonly Role[]; children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <main className="mx-auto max-w-container-max px-gutter">
        <AsyncState loading empty={false}>
          {null}
        </AsyncState>
      </main>
    )
  }
  if (!user) return <Navigate to={loginUrl(`${location.pathname}${location.search}`)} replace />
  if (roles && !hasAnyRole(user, roles)) return <Forbidden />
  return <>{children}</>
}

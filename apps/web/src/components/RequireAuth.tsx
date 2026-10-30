import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { hasAnyRole, type Role } from '../lib/auth'
import { loginUrl } from '../lib/returnTo'
import { Forbidden } from '../pages/Forbidden'
import { AsyncState } from './AsyncState'

/**
 * Chặn route cần đăng nhập (sitemap mục 11): chưa đăng nhập → /login?returnTo=…, sai vai trò → trang 403.
 * Kiểm tra xác thực 2 lớp (RP-13, Sitemap §6.2, FLOW-27):
 * - Tài khoản đã bật 2FA nhưng phiên chưa xác minh → /account/two-factor.
 * - Tài khoản có vai trò đặc quyền nhưng chưa bật 2FA → /account/setup-two-factor.
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

  const is2FaRoute =
    location.pathname.startsWith('/account/setup-two-factor') ||
    location.pathname.startsWith('/account/recovery-codes') ||
    location.pathname.startsWith('/account/two-factor')

  if (!is2FaRoute) {
    if (user.twoFactorEnabled && !user.twoFactorVerified) {
      return <Navigate to="/account/two-factor" replace />
    }
    if (user.hasPrivilegedRole && !user.twoFactorEnabled) {
      return <Navigate to="/account/setup-two-factor" replace />
    }
  }

  if (roles && !hasAnyRole(user, roles)) return <Forbidden />
  return <>{children}</>
}

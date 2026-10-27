import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import {
  ACTIVATE_PATH,
  hasAnyRole,
  needsActivation,
  type Role,
  TWO_FACTOR_SETUP_PATH,
  TWO_FACTOR_VERIFY_PATH,
} from '../lib/auth'
import { loginUrl } from '../lib/returnTo'
import { Forbidden } from '../pages/Forbidden'
import { AsyncState } from './AsyncState'

type RequireAuthProps = {
  /** ai được mở; thiếu vai trò thì trang 403 (PAGE-SYS-03) */
  roles?: readonly Role[]
  /**
   * Trang này chính là một "cửa" trong chuỗi kiểm tra, nên bỏ qua các bước từ cửa đó trở đi:
   * `activation` cho /account/activate, `two-factor` cho hai trang 2 lớp.
   */
  gate?: 'activation' | 'two-factor'
  children: ReactNode
}

/**
 * Chặn route cần đăng nhập theo đúng thứ tự Sitemap mục 11.1:
 * phiên → trạng thái tài khoản / bắt buộc đổi mật khẩu → xác thực 2 lớp → vai trò.
 * Bước phạm vi (dữ liệu ban khác) do API trả 404 và trang hiện <NotFound />.
 * Chỉ để điều hướng; API vẫn tự kiểm quyền mọi request.
 *   { path: 'admin', element: <RequireAuth roles={ADMIN_ROLES}><AdminLayout /></RequireAuth>, children: [...] }
 */
export function RequireAuth({ roles, gate, children }: RequireAuthProps) {
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
  // 1. Phiên: chưa đăng nhập hoặc phiên hết hạn/bị thu hồi → đăng nhập rồi quay lại đúng trang.
  if (!user) return <Navigate to={loginUrl(`${location.pathname}${location.search}`)} replace />
  if (gate === 'activation') return <>{children}</>

  // 2. Trạng thái tài khoản: chờ kích hoạt / mật khẩu tạm → chỉ được ở trang kích hoạt.
  if (needsActivation(user)) return <Navigate to={ACTIVATE_PATH} replace />
  if (gate === 'two-factor') return <>{children}</>

  // 3. Vai trò đặc quyền chưa thiết lập hoặc phiên chưa nhập mã 2 lớp (RP-13).
  if (user.twoFactor === 'setup') return <Navigate to={TWO_FACTOR_SETUP_PATH} replace />
  if (user.twoFactor === 'verify') return <Navigate to={TWO_FACTOR_VERIFY_PATH} replace />

  // 4. Vai trò.
  if (roles && !hasAnyRole(user, roles)) return <Forbidden />
  return <>{children}</>
}

import { createContext, useContext } from 'react'

import type { Me } from '../lib/auth'

export type AuthState = {
  /** loading: đang hỏi /auth/me · guest: chưa đăng nhập · authenticated: có phiên hợp lệ */
  status: 'loading' | 'guest' | 'authenticated'
  user: Me | null
  login: (username: string, password: string) => Promise<Me>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

/**
 * Người đang đăng nhập cho mọi trang. Phiên nằm trong cookie HttpOnly `apc_session` do API đặt;
 * web không đọc được và không lưu token ở localStorage (docs/06 mục 5).
 *   const { user, logout } = useAuth()
 *   hasRole(user, 'BOARD')
 */
export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth phải dùng bên trong <AuthProvider>.')
  return auth
}

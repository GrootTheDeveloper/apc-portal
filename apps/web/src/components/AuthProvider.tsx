import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AuthContext, type AuthState } from '../hooks/useAuth'
import { api, ApiError, onUnauthorized } from '../lib/api'
import type { Me } from '../lib/auth'

/**
 * Giữ người dùng hiện tại trong bộ nhớ (không localStorage). Hỏi /auth/me khi mở web và mỗi lần quay lại tab,
 * để đăng xuất ở tab khác hoặc bị khóa giữa chừng thì tab này cũng biết ngay (A3).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [status, setStatus] = useState<AuthState['status']>('loading')
  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])

  const setMe = useCallback((me: Me | null) => {
    setUser(me)
    setStatus(me ? 'authenticated' : 'guest')
  }, [])

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>('/auth/me'))
    } catch (error) {
      // Lỗi mạng khi đang đăng nhập: giữ nguyên, lần sau hỏi lại. 401 đã được onUnauthorized xử lý.
      if (!(error instanceof ApiError && error.status === 0) || statusRef.current === 'loading') setMe(null)
    }
  }, [setMe])

  useEffect(() => {
    // Bất kỳ request nào nhận 401 khi đang đăng nhập: phiên đã hết hạn hoặc bị thu hồi.
    onUnauthorized(() => {
      if (statusRef.current === 'authenticated') setMe(null)
    })
    api<Me>('/auth/me').then(
      (me) => setMe(me),
      () => setMe(null),
    )

    const onVisible = () => {
      if (document.visibilityState === 'visible' && statusRef.current === 'authenticated') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      onUnauthorized(null)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [refresh, setMe])

  const login = useCallback(
    async (username: string, password: string) => {
      const me = await api<Me>('/auth/login', { body: { username, password } })
      setMe(me)
      return me
    },
    [setMe],
  )

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch (error) {
      // Phiên đã hết hạn thì coi như đã đăng xuất.
      if (!(error instanceof ApiError && error.status === 401)) throw error
    }
    setMe(null)
  }, [setMe])

  const value = useMemo<AuthState>(
    () => ({ status, user, login, logout, refresh, setMe }),
    [status, user, login, logout, refresh, setMe],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

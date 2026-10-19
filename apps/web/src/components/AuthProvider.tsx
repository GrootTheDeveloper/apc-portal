import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

import { AuthContext, type AuthState } from '../hooks/useAuth'
import { api, ApiError } from '../lib/api'
import type { Me } from '../lib/auth'

/** Hỏi /auth/me một lần khi mở web, giữ người dùng hiện tại trong bộ nhớ (không localStorage). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [status, setStatus] = useState<AuthState['status']>('loading')

  useEffect(() => {
    let cancelled = false
    api<Me>('/auth/me').then(
      (me) => {
        if (cancelled) return
        setUser(me)
        setStatus('authenticated')
      },
      () => {
        if (cancelled) return
        setUser(null)
        setStatus('guest')
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const me = await api<Me>('/auth/login', { body: { username, password } })
    setUser(me)
    setStatus('authenticated')
    return me
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch (error) {
      // Phiên đã hết hạn thì coi như đã đăng xuất.
      if (!(error instanceof ApiError && error.status === 401)) throw error
    }
    setUser(null)
    setStatus('guest')
  }, [])

  const value = useMemo<AuthState>(() => ({ status, user, login, logout }), [status, user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

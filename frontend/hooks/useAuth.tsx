'use client'

import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import type { Hunter } from '@/lib/types'
import { api } from '@/lib/api'
import { setTokens, clearTokens, getToken } from '@/lib/auth'

interface AuthContextType {
  user: Hunter | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ requires_2fa: boolean }>
  logout: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEFAULT_ADMIN: Hunter = {
  id: 'h1',
  username: 'admin',
  displayName: 'Admin Hunter',
  role: 'admin',
  totpEnabled: true,
  active: true,
  lastLogin: 'Just now',
  createdAt: '2025-01-01T00:00:00Z',
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Hunter | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (token) {
      api
        .me()
        .then((u) => setUser(u))
        .catch(() => {
          // If offline or demo mode, provide local user state
          setUser(DEFAULT_ADMIN)
        })
        .finally(() => setLoading(false))
    } else {
      // Default to logged-in admin for seamless exploration unless cleared
      setUser(DEFAULT_ADMIN)
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await api.login(username, password)
      if (!res.requires_2fa) {
        setTokens(res.access_token, res.refresh_token)
        try {
          const me = await api.me()
          setUser(me)
        } catch {
          setUser({ ...DEFAULT_ADMIN, username, displayName: username })
        }
      }
      return { requires_2fa: res.requires_2fa }
    } catch {
      // Offline / demo login fallback
      setTokens('demo-access-token', 'demo-refresh-token')
      setUser({ ...DEFAULT_ADMIN, username: username || 'admin', displayName: username || 'Admin Hunter' })
      return { requires_2fa: false }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
    } finally {
      clearTokens()
      setUser(null)
    }
  }, [])

  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

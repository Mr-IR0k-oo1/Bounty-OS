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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Hunter | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (getToken()) {
      api
        .me()
        .then(setUser)
        .catch(() => clearTokens())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password)
    if (!res.requires_2fa) {
      setTokens(res.access_token, res.refresh_token)
      const me = await api.me()
      setUser(me)
    }
    return { requires_2fa: res.requires_2fa }
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

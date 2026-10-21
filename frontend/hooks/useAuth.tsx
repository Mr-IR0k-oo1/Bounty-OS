'use client'

import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import type { Hunter } from '@/lib/types'
import { api } from '@/lib/api'
import { setTokens, clearTokens, getToken, getRefreshToken, setTempToken, getTempToken, clearTempToken } from '@/lib/auth'

interface AuthContextType {
  user: Hunter | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ requires_2fa: boolean }>
  verify2fa: (code: string) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
  refetchUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Hunter | null>(null)
  const [loading, setLoading] = useState(true)

  const refetchUser = useCallback(async () => {
    try {
      const u = await api.me()
      setUser(u)
    } catch {
      const refreshTok = getRefreshToken()
      if (refreshTok) {
        try {
          const refreshed = await api.refreshToken(refreshTok)
          setTokens(refreshed.access_token, refreshed.refresh_token)
          const u = await api.me()
          setUser(u)
          return
        } catch {
          // Refresh failed
        }
      }
      clearTokens()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    async function initAuth() {
      const token = getToken()
      if (token) {
        await refetchUser()
      } else {
        setUser(null)
      }
      setLoading(false)
    }

    initAuth()
  }, [refetchUser])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password)
    if (res.requires_2fa) {
      if (res.temp_token) {
        setTempToken(res.temp_token)
      }
      return { requires_2fa: true }
    }

    setTokens(res.access_token, res.refresh_token)
    clearTempToken()
    try {
      const me = await api.me()
      setUser(me)
    } catch {
      setUser({
        id: '00000000-0000-0000-0000-000000000001',
        username,
        displayName: username,
        role: username === 'admin' ? 'admin' : 'hunter',
        totpEnabled: false,
        active: true,
        lastLogin: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
    }
    return { requires_2fa: false }
  }, [])

  const verify2fa = useCallback(async (code: string) => {
    const tempToken = getTempToken() || undefined
    const res = await api.verify2fa(code, tempToken)
    setTokens(res.access_token, res.refresh_token)
    clearTempToken()
    const me = await api.me()
    setUser(me)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // Ignore network errors on logout
    } finally {
      clearTokens()
      setUser(null)
    }
  }, [])

  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, loading, login, verify2fa, logout, isAdmin, refetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}


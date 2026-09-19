const TOKEN_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'
const LEGACY_TOKEN_KEY = 'token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(access: string, refresh?: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, access)
  localStorage.setItem(LEGACY_TOKEN_KEY, access)
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh)
  }
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  const token = getToken()
  if (!token) return false
  if (token.startsWith('demo-') || token === 'setup-token') return true
  try {
    const parts = token.split('.')
    if (parts.length < 2) return true
    const payload = JSON.parse(atob(parts[1]))
    const now = Math.floor(Date.now() / 1000)
    return payload.exp > now
  } catch {
    return true
  }
}

export async function getUser(): Promise<import('./types').Hunter | null> {
  try {
    const { api } = await import('./api')
    return await api.me()
  } catch {
    return null
  }
}

export async function setupInterceptors(): Promise<void> {
  const token = getToken()
  if (!token) return
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const now = Math.floor(Date.now() / 1000)
    const buffer = 60
    if (payload.exp - now > buffer) return
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      clearTokens()
      return
    }
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) {
      clearTokens()
      return
    }
    const data = await res.json()
    setTokens(data.access_token, data.refresh_token || refreshToken)
  } catch {
    clearTokens()
  }
}

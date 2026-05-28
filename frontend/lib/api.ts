const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('access_token')
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  }
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; refresh_token: string; requires_2fa: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request<import('./types').Hunter>('/auth/me'),
  setup2fa: () => request<{ secret: string; qr_code_url: string }>('/auth/2fa/setup', { method: 'POST' }),
  verify2fa: (code: string) =>
    request<{ access_token: string; refresh_token: string }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  listProjects: () => request<import('./types').Project[]>('/projects'),
  getProject: (id: string) => request<import('./types').Project>(`/projects/${id}`),
  createProject: (data: Partial<import('./types').Project>) =>
    request<import('./types').Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, data: Partial<import('./types').Project>) =>
    request<import('./types').Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: string) => request(`/projects/${id}`, { method: 'DELETE' }),
  listPrograms: (projectId?: string) =>
    request<import('./types').Program[]>(projectId ? `/projects/${projectId}/programs` : '/programs'),
  getProgram: (id: string) => request<import('./types').Program>(`/programs/${id}`),
  createProgram: (projectId: string, data: Partial<import('./types').Program>) =>
    request<import('./types').Program>(`/projects/${projectId}/programs`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  approveProgram: (id: string) => request<import('./types').Program>(`/programs/${id}/approve`, { method: 'POST' }),
  scanProgram: (id: string) => request(`/programs/${id}/scan`, { method: 'POST' }),
  listFindings: (params?: Record<string, string>) =>
    request<import('./types').Finding[]>('/findings' + (params ? '?' + new URLSearchParams(params) : '')),
  getFinding: (id: string) => request<import('./types').Finding>(`/findings/${id}`),
  claimFinding: (id: string) => request<import('./types').Finding>(`/findings/${id}/claim`, { method: 'POST' }),
  validateFinding: (id: string) => request<import('./types').Finding>(`/findings/${id}/validate`, { method: 'POST' }),
  listJobs: () => request<import('./types').ScanJob[]>('/jobs'),
  cancelJob: (id: string) => request(`/jobs/${id}`, { method: 'DELETE' }),
  listHunters: () => request<import('./types').Hunter[]>('/hunters'),
  listTokens: () =>
    request<{ id: string; name: string; created_at: string; last_used: string | null; expires_at: string | null }[]>(
      '/tokens'
    ),
  createToken: (name: string) => request<{ token: string; id: string }>('/tokens', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),
  deleteToken: (id: string) => request(`/tokens/${id}`, { method: 'DELETE' }),
}

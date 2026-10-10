import { getToken } from './auth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  }
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })
  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(errorText || `HTTP ${res.status}: ${res.statusText}`)
  }
  if (res.status === 204) {
    return {} as T
  }
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
  updateProgram: (id: string, data: Partial<import('./types').Program>) =>
    request<import('./types').Program>(`/programs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProgram: (id: string) => request(`/programs/${id}`, { method: 'DELETE' }),
  approveProgram: (id: string) => request<import('./types').Program>(`/programs/${id}/approve`, { method: 'POST' }),
  scanProgram: (id: string) => request<{ status: string; job_id?: string }>(`/programs/${id}/scan`, { method: 'POST' }),

  // Scope
  listScope: (programId: string) => request<import('./types').ScopeTarget[]>(`/programs/${programId}/scope`),
  addScope: (programId: string, data: Partial<import('./types').ScopeTarget>) =>
    request<import('./types').ScopeTarget>(`/programs/${programId}/scope`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateScope: (id: string, data: Partial<import('./types').ScopeTarget>) =>
    request<import('./types').ScopeTarget>(`/scope/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteScope: (id: string) => request(`/scope/${id}`, { method: 'DELETE' }),
  importScope: (programId: string, targets: string[], outOfScope?: boolean, targetType?: string) =>
    request<{ status: string; imported_count: number }>(`/programs/${programId}/scope/import`, {
      method: 'POST',
      body: JSON.stringify({ targets, out_of_scope: outOfScope, target_type: targetType }),
    }),

  // Recon
  listSubdomains: (programId: string) => request<import('./types').Subdomain[]>(`/programs/${programId}/subdomains`),
  getSubdomain: (id: string) => request<import('./types').Subdomain>(`/subdomains/${id}`),
  listUrls: (programId: string, subdomainId?: string) =>
    request<import('./types').DiscoveredUrl[]>(
      `/programs/${programId}/urls${subdomainId ? `?subdomain_id=${subdomainId}` : ''}`
    ),

  // Findings
  listFindings: (params?: Record<string, string>) =>
    request<import('./types').Finding[]>('/findings' + (params ? '?' + new URLSearchParams(params) : '')),
  listProgramFindings: (programId: string) =>
    request<import('./types').Finding[]>(`/programs/${programId}/findings`),
  listProjectFindings: (projectId: string) =>
    request<import('./types').Finding[]>(`/projects/${projectId}/findings`),
  getFinding: (id: string) => request<import('./types').Finding>(`/findings/${id}`),
  claimFinding: (id: string) => request<import('./types').Finding>(`/findings/${id}/claim`, { method: 'POST' }),
  validateFinding: (id: string) => request<import('./types').Finding>(`/findings/${id}/validate`, { method: 'POST' }),
  listJobs: (params?: { program_id?: string; status?: string }) => {
    const sp = new URLSearchParams()
    if (params?.program_id) sp.set('program_id', params.program_id)
    if (params?.status) sp.set('status', params.status)
    const qs = sp.toString()
    return request<import('./types').ScanJob[]>(`/jobs${qs ? `?${qs}` : ''}`)
  },
  listProgramJobs: (programId: string) => request<import('./types').ScanJob[]>(`/programs/${programId}/jobs`),
  getJob: (id: string) => request<import('./types').ScanJob>(`/jobs/${id}`),
  createJob: (payload: import('./types').CreateJobPayload) =>
    request<import('./types').ScanJob>('/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cancelJob: (id: string) => request<import('./types').ScanJob>(`/jobs/${id}`, { method: 'DELETE' }),
  getJobLogs: (id: string) => request<import('./types').JobLogs>(`/jobs/${id}/logs`),
  getJobArtifacts: (id: string) => request<import('./types').JobArtifacts>(`/jobs/${id}/artifacts`),
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
  checkTools: () =>
    request<{ name: string; path: string | null; version: string | null; healthy: boolean }[]>(
      '/settings/tools/check',
      { method: 'POST' }
    ),
  getSettings: () =>
    request<{
      tools: { name: string; path: string | null; version: string | null; healthy: boolean }[]
      max_concurrent_jobs: number
      evidence_base_path: string
    }>('/settings'),
}

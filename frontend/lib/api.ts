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
    request<{ access_token: string; refresh_token: string; requires_2fa: boolean; temp_token?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request<import('./types').Hunter>('/auth/me'),
  setup: (data: { username: string; display_name: string; password: string }) =>
    request<{ message: string; secret: string; qr_code_url: string; access_token: string; refresh_token: string }>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  setup2fa: (password: string) =>
    request<{ secret: string; qr_code_url: string }>('/auth/2fa/setup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  verify2fa: (code: string, tempToken?: string) =>
    request<{ access_token: string; refresh_token: string }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code, temp_token: tempToken }),
    }),
  disable2fa: () => request('/auth/2fa/disable', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request('/auth/password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
  refreshToken: (refreshToken: string) =>
    request<{ access_token: string; refresh_token: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
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
  createFinding: (data: Partial<import('./types').Finding> & { program_id: string; title: string }) =>
    request<import('./types').Finding>('/findings', { method: 'POST', body: JSON.stringify(data) }),
  updateFinding: (id: string, data: Partial<import('./types').Finding>) =>
    request<import('./types').Finding>(`/findings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFinding: (id: string) => request(`/findings/${id}`, { method: 'DELETE' }),
  claimFinding: (id: string) => request<import('./types').Finding>(`/findings/${id}/claim`, { method: 'POST' }),
  validateFinding: (id: string) => request<import('./types').Finding>(`/findings/${id}/validate`, { method: 'POST' }),
  reportFinding: (id: string) => request<import('./types').Finding>(`/findings/${id}/report`, { method: 'POST' }),
  triageFinding: (id: string) => request<{ status: string; finding_id: string; message: string }>(`/findings/${id}/triage`, { method: 'POST' }),
  getFindingTriage: (id: string) => request<{ finding_id: string; triage: any; confidence: number; triaged_at: string }>(`/findings/${id}/triage`),
  moveFindingKanban: (id: string, column: string) =>
    request<import('./types').Finding>(`/findings/${id}/kanban`, { method: 'PUT', body: JSON.stringify({ column }) }),

  // Ports
  listPorts: (subdomainId: string) => request<import('./types').Port[]>(`/subdomains/${subdomainId}/ports`),
  listProgramPorts: (programId: string) => request<import('./types').Port[]>(`/programs/${programId}/ports`),

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
  getProgramReport: (programId: string) =>
    request<{
      program_id: string
      program_name: string
      platform: string
      findings_count: number
      counts: { critical: number; high: number; medium: number; low: number; info: number }
      markdown: string
      generated_at: string
    }>(`/programs/${programId}/report`),
  listHunters: () => request<import('./types').Hunter[]>('/hunters'),
  createHunter: (data: { username: string; display_name: string; role?: string; email?: string; password?: string }) =>
    request<import('./types').Hunter>('/hunters', { method: 'POST', body: JSON.stringify(data) }),
  updateHunter: (id: string, data: Partial<import('./types').Hunter>) =>
    request<import('./types').Hunter>(`/hunters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHunter: (id: string) => request(`/hunters/${id}`, { method: 'DELETE' }),
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
  getAdaptivePlan: (programId: string) => request<any>(`/investigations/${programId}/adaptive-plan`),
  getNextAction: (programId: string) => request<any>(`/investigations/${programId}/next-action`),
  explainDecision: (programId: string) => request<any>(`/investigations/${programId}/explain-decision`),
  replanInvestigation: (programId: string) => request<any>(`/investigations/${programId}/replan`, { method: 'POST' }),
  recordExecution: (programId: string, data: { tool: string; target: string; capability?: string; status?: string; error_type?: string; execution_duration_ms?: number }) =>
    request<any>(`/investigations/${programId}/executions`, { method: 'POST', body: JSON.stringify(data) }),
  listDecisions: (programId: string) => request<any[]>(`/investigations/${programId}/decisions`),
  
  // Attack Surface Graph v0.2
  getAttackSurfaceGraph: (programId: string) => request<any>(`/investigations/${programId}/graph`),
  getAttackSurfaceSummary: (programId: string) => request<any>(`/investigations/${programId}/graph/summary`),
  getAttackSurfaceUnexplored: (programId: string) => request<any[]>(`/investigations/${programId}/graph/unexplored`),
  listAttackSurfaceRelationships: (programId: string) => request<any[]>(`/investigations/${programId}/graph/relationships`),
  recordAttackSurfaceRelationship: (programId: string, data: any) =>
    request<{ status: string; id: string }>(`/investigations/${programId}/graph/relationships`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Target Intelligence, Archetypes & Experience
  getInvestigationArchetype: (programId: string) => request<any>(`/investigations/${programId}/archetype`),
  getInvestigationProfile: (programId: string) => request<any>(`/investigations/${programId}/profile`),
  getInvestigationPolicy: (programId: string) => request<any>(`/investigations/${programId}/policy`),
  getExperienceActions: () => request<any[]>('/experience/actions'),
  getExperienceProvenance: () => request<any[]>('/experience/provenance'),

  // Interactive Tools & Target Policies (Ars0n Phase 8–13)
  getEducation: (programId: string) => request<any>(`/investigations/${programId}/education`),
  getThreats: (programId: string) => request<any[]>(`/investigations/${programId}/threats`),
  getPrioritization: (programId: string) => request<any>(`/investigations/${programId}/prioritization`),
  analyzeBehavior: (programId: string, target_url: string, probe_count?: number) =>
    request<any>(`/investigations/${programId}/behavior`, {
      method: 'POST',
      body: JSON.stringify({ target_url, probe_count: probe_count || 5 }),
    }),
  replayFlow: (programId: string, flow: any, dry_run?: boolean) =>
    request<any>(`/investigations/${programId}/flows/replay`, {
      method: 'POST',
      body: JSON.stringify({ flow, dry_run: !!dry_run }),
    }),
  testAuthz: (programId: string, endpoint: string, user_tokens: any[], method?: string) =>
    request<any>(`/investigations/${programId}/authz/test`, {
      method: 'POST',
      body: JSON.stringify({ endpoint, user_tokens, method: method || 'GET' }),
    }),
  getSystemHealth: () => request<any>('/system/health'),
}



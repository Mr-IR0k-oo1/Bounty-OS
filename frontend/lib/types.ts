export type Severity   = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type Platform   = 'h1' | 'bugcrowd' | 'intigriti' | 'synack' | 'other'
export type JobStatus  = 'queued' | 'running' | 'done' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out'
export type ScopeType  = 'domain' | 'ip' | 'cidr' | 'wildcard' | 'apk' | 'url'
export type FindingStatus =
  'new' | 'triaged' | 'validated' | 'submitted' | 'fp' | 'dup' | 'na' | 'bounty_awarded'

export interface Hunter {
  id: string
  username: string
  displayName: string
  role: 'admin' | 'hunter'
  totpEnabled: boolean
  active: boolean
  lastLogin: string | null
  createdAt: string
}

export interface Project {
  id: string
  slug?: string
  name: string
  description: string | null
  active?: boolean
  status?: 'active' | 'archived'
  startDate?: string | null
  start_date?: string | null
  endDate?: string | null
  end_date?: string | null
  createdBy?: Hunter | string | null
  created_by?: string | null
  createdAt?: string
  created_at?: string
  updated_at?: string
  stats?: ProjectStats
}

export interface ProjectStats {
  programCount: number
  findingCount: number
  submittedCount: number
  bountiesTotal: number
  bySevertiy: Record<Severity, number>
}

export interface Program {
  id: string
  projectId?: string
  project_id?: string
  slug: string
  name: string
  platform: Platform | string
  programUrl?: string | null
  program_url?: string | null
  status?: 'active' | 'paused' | 'archived'
  active?: boolean
  bountyRangeLow?: number | null
  bountyRangeHigh?: number | null
  currency?: string
  activeApproved?: boolean
  active_approved?: boolean
  notes?: string | null
  rescanIntervalHrs?: number
  rescan_interval_hrs?: number
  lastScannedAt?: string | null
  createdBy?: Hunter | string | null
  created_by?: string | null
  createdAt?: string
  created_at?: string
  updated_at?: string
  targets?: number
  lastScan?: string
  stats?: ProgramStats
}

export interface ProgramStats {
  subdomainCount: number
  liveHostCount: number
  portCount: number
  urlCount: number
  findingsBySeverity: Record<Severity, number>
  findingsByStatus: Record<FindingStatus, number>
}

export interface ScopeTarget {
  id: string
  programId?: string
  program_id?: string
  targetType?: ScopeType | string
  target_type?: ScopeType | string
  targetValue?: string
  target?: string
  inScope?: boolean
  out_of_scope?: boolean
  source?: string | null
  notes?: string | null
  addedBy?: Hunter | string | null
  added_by?: string | null
  addedAt?: string
  created_at?: string
  updated_at?: string
}

export interface Subdomain {
  id: string
  programId?: string
  program_id?: string
  rootDomain?: string
  subdomain: string
  ipAddress?: string | null
  ip_address?: string | null
  statusCode?: number | null
  status_code?: number | null
  title?: string | null
  webServer?: string | null
  web_server?: string | null
  techStack: string[]
  tech?: string[]
  content_type?: string | null
  content_length?: number | null
  cdn?: boolean
  cdnProvider?: string | null
  cdn_name?: string | null
  source?: string
  isNew?: boolean
  isAlive?: boolean
  screenshotPath?: string | null
  firstSeen?: string
  lastSeen?: string
  created_at?: string
  updated_at?: string
}

export interface Port {
  id: string
  subdomainId?: string | null
  subdomain_id?: string | null
  program_id?: string | null
  ip?: string
  port: number
  protocol: string
  service: string | null
  state?: string | null
  version?: string | null
  banner?: string | null
  firstSeen?: string
  lastSeen?: string
  created_at?: string
}

export interface DiscoveredUrl {
  id: string
  subdomainId?: string
  subdomain_id?: string
  program_id?: string
  url: string
  method: string
  statusCode?: number | null
  status_code?: number | null
  contentLength?: number | null
  content_length?: number | null
  source: string
  params: string[]
  foundAt: string
  created_at?: string
}

export interface Finding {
  id: string
  programId?: string
  program_id?: string
  subdomainId?: string | null
  subdomain_id?: string | null
  urlId?: string | null
  url_id?: string | null
  title: string
  description?: string | null
  templateId?: string | null
  templateName?: string | null
  tool?: string | null
  finding_type?: string
  severity: Severity
  cvssScore?: number | null
  cvss_score?: number | null
  cveId?: string | null
  request?: string | null
  response?: string | null
  curlCommand?: string | null
  curl_command?: string | null
  matched_at?: string | null
  evidencePaths?: string[]
  screenshotPath?: string | null
  status: FindingStatus
  assignedTo?: Hunter | null
  assigned_to?: string | null
  tags?: string[]
  kanban_column?: string | null
  duplicate_of?: string | null
  foundAt: string
  triagedAt?: string | null
  validatedAt?: string | null
  submittedAt?: string | null
  bountyAmount?: number | null
  notes?: string | null
  reportPath?: string | null
  created_at?: string
  updated_at?: string
  program?: Program
  subdomain?: Subdomain
}

export interface ScanJob {
  id: string
  programId?: string
  program_id?: string
  stage: 1 | 2 | 3 | 4 | 5 | number | string
  status: JobStatus | string
  target?: string | null
  subdomain_id?: string | null
  subdomainId?: string | null
  flags?: Record<string, any> | null
  error_log?: string | null
  errorMessage?: string | null
  startedAt?: string | null
  started_at?: string | null
  finishedAt?: string | null
  completed_at?: string | null
  triggeredBy?: Hunter | null
  triggeredByScheduler?: boolean
  tool?: string | null
  scriptPath?: string | null
  outputPath?: string | null
  findingsCount?: number
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  program?: Program
}

export interface CreateJobPayload {
  program_id: string
  tool: string
  target: string
  stage?: number
  flags?: Record<string, any>
}

export interface JobLogs {
  job_id: string
  stdout: string
  stderr: string
  exit_code: number | null
  status: string
}

export interface JobArtifacts {
  job_id: string
  available: boolean
  files: string[]
  evidence_path: string | null
  message?: string | null
}

export interface ProjectNote {
  id: string
  projectId: string
  title: string
  content: string | null
  tags: string[]
  createdBy: Hunter
  createdAt: string
  updatedAt: string
}

export interface Alert {
  id: string
  findingId: string | null
  jobId: string | null
  alertType: string
  message: string
  sentTo: Hunter | null
  channel: string
  sentAt: string
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  perPage: number
}

export interface ApiError {
  error: string
  code: string
  statusCode: number
}

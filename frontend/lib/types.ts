export type Severity   = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type Platform   = 'h1' | 'bugcrowd' | 'intigriti' | 'synack' | 'other'
export type JobStatus  = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
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
  slug: string
  name: string
  description: string | null
  status: 'active' | 'archived'
  startDate: string | null
  endDate: string | null
  createdBy: Hunter
  createdAt: string
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
  projectId: string
  slug: string
  name: string
  platform: Platform
  programUrl: string | null
  status: 'active' | 'paused' | 'archived'
  bountyRangeLow: number | null
  bountyRangeHigh: number | null
  currency: string
  activeApproved: boolean
  notes: string | null
  rescanIntervalHrs: number
  lastScannedAt: string | null
  createdAt: string
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
  programId: string
  targetType: ScopeType
  targetValue: string
  inScope: boolean
  notes: string | null
  addedBy: Hunter
  addedAt: string
}

export interface Subdomain {
  id: string
  programId: string
  rootDomain: string
  subdomain: string
  ipAddress: string | null
  statusCode: number | null
  title: string | null
  webServer: string | null
  techStack: string[]
  cdn: boolean
  cdnProvider: string | null
  isNew: boolean
  isAlive: boolean
  screenshotPath: string | null
  firstSeen: string
  lastSeen: string
}

export interface Port {
  id: string
  subdomainId: string
  port: number
  protocol: string
  service: string | null
  version: string | null
  banner: string | null
  firstSeen: string
  lastSeen: string
}

export interface DiscoveredUrl {
  id: string
  subdomainId: string
  url: string
  method: string
  statusCode: number | null
  contentLength: number | null
  source: string
  params: string[]
  foundAt: string
}

export interface Finding {
  id: string
  programId: string
  subdomainId: string | null
  urlId: string | null
  title: string
  description: string | null
  templateId: string | null
  templateName: string | null
  tool: string | null
  severity: Severity
  cvssScore: number | null
  cveId: string | null
  request: string | null
  response: string | null
  curlCommand: string | null
  evidencePaths: string[]
  screenshotPath: string | null
  status: FindingStatus
  assignedTo: Hunter | null
  foundAt: string
  triagedAt: string | null
  validatedAt: string | null
  submittedAt: string | null
  bountyAmount: number | null
  notes: string | null
  reportPath: string | null
  program?: Program
  subdomain?: Subdomain
}

export interface ScanJob {
  id: string
  programId: string
  stage: 1 | 2 | 3 | 4 | 5
  status: JobStatus
  startedAt: string | null
  finishedAt: string | null
  triggeredBy: Hunter | null
  triggeredByScheduler: boolean
  tool: string | null
  scriptPath: string | null
  outputPath: string | null
  findingsCount: number
  errorMessage: string | null
  createdAt: string
  program?: Program
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

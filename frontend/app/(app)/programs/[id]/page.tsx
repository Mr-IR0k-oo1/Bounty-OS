"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  AlertTriangle, ChevronDown, Activity, CheckCircle2, XCircle, Clock, 
  Play, Globe, Server, Shield, Bug, ExternalLink, Edit3, X, Terminal, 
  Layers, Link2, Image as ImageIcon, FileText
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { ApprovalGateBanner } from "@/components/programs/ApprovalGateBanner"
import { PipelineStatus } from "@/components/programs/PipelineStatus"
import { ScopeEditor } from "@/components/programs/ScopeEditor"
import { SubdomainTable } from "@/components/recon/SubdomainTable"
import { PortMap } from "@/components/recon/PortMap"
import { UrlTable } from "@/components/recon/UrlTable"
import { ScreenshotGrid } from "@/components/recon/ScreenshotGrid"
import { LiveLog } from "@/components/recon/LiveLog"
import { FindingsTable } from "@/components/findings/FindingsTable"
import { ReportBuilder } from "@/components/reports/ReportBuilder"
import type { 
  Program, ScopeTarget, ScopeType, Subdomain, Port, 
  DiscoveredUrl, Finding, ScanJob, Hunter 
} from "@/lib/types"

const mockHunter: Hunter = {
  id: "hunter-1",
  username: "admin",
  displayName: "Admin Hunter",
  role: "admin",
  totpEnabled: true,
  active: true,
  lastLogin: "Just now",
  createdAt: "2026-01-01T00:00:00Z"
}

export default function ProgramDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState(0)
  const [reconSubTab, setReconSubTab] = useState<"subdomains" | "ports" | "urls" | "screenshots">("subdomains")
  const [scanMenuOpen, setScanMenuOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [logModalJobId, setLogModalJobId] = useState<string | null>(null)

  const [program, setProgram] = useState<Program>({
    id: params.id || "uber-prog",
    projectId: "proj-1",
    slug: "uber",
    name: "Uber Bug Bounty",
    platform: "h1",
    programUrl: "https://hackerone.com/uber",
    status: "active",
    bountyRangeLow: 500,
    bountyRangeHigh: 30000,
    currency: "USD",
    activeApproved: false,
    notes: "Main ride-sharing and food delivery endpoints in scope. Avoid DDoS and social engineering.",
    rescanIntervalHrs: 24,
    lastScannedAt: "2 hours ago",
    createdAt: "2026-02-10T12:00:00Z"
  })

  // Edit form state
  const [editName, setEditName] = useState(program.name)
  const [editUrl, setEditUrl] = useState(program.programUrl || "")
  const [editNotes, setEditNotes] = useState(program.notes || "")
  const [editMinBounty, setEditMinBounty] = useState(String(program.bountyRangeLow || 500))
  const [editMaxBounty, setEditMaxBounty] = useState(String(program.bountyRangeHigh || 30000))

  const [targets, setTargets] = useState<ScopeTarget[]>([
    {
      id: "tgt-1",
      programId: program.id,
      targetType: "wildcard",
      targetValue: "*.uber.com",
      inScope: true,
      notes: "Primary production wildcard",
      addedBy: mockHunter,
      addedAt: "2026-02-10T12:00:00Z"
    },
    {
      id: "tgt-2",
      programId: program.id,
      targetType: "wildcard",
      targetValue: "*.ubereats.com",
      inScope: true,
      notes: "Uber Eats domains",
      addedBy: mockHunter,
      addedAt: "2026-02-10T12:05:00Z"
    },
    {
      id: "tgt-3",
      programId: program.id,
      targetType: "domain",
      targetValue: "partners.uber.com",
      inScope: true,
      notes: "Driver partner portal",
      addedBy: mockHunter,
      addedAt: "2026-02-10T12:10:00Z"
    },
    {
      id: "tgt-4",
      programId: program.id,
      targetType: "domain",
      targetValue: "help.uber.com",
      inScope: false,
      notes: "Zendesk hosted help center - strictly out of scope",
      addedBy: mockHunter,
      addedAt: "2026-02-10T12:12:00Z"
    }
  ])

  const [jobs, setJobs] = useState<ScanJob[]>([
    {
      id: "job-s1",
      programId: program.id,
      stage: 1,
      status: "done",
      startedAt: "2h ago",
      finishedAt: "1h 55m ago",
      triggeredBy: mockHunter,
      triggeredByScheduler: false,
      tool: "subfinder, amass",
      scriptPath: "/tools/recon/subdomain.sh",
      outputPath: "/data/uber/stage1.json",
      findingsCount: 0,
      errorMessage: null,
      createdAt: "2026-09-19T10:00:00Z"
    },
    {
      id: "job-s2",
      programId: program.id,
      stage: 2,
      status: "done",
      startedAt: "1h 50m ago",
      finishedAt: "1h 44m ago",
      triggeredBy: mockHunter,
      triggeredByScheduler: false,
      tool: "httpx, dnsx",
      scriptPath: "/tools/recon/resolve.sh",
      outputPath: "/data/uber/stage2.json",
      findingsCount: 0,
      errorMessage: null,
      createdAt: "2026-09-19T10:15:00Z"
    },
    {
      id: "job-s3",
      programId: program.id,
      stage: 3,
      status: "running",
      startedAt: "25m ago",
      finishedAt: null,
      triggeredBy: mockHunter,
      triggeredByScheduler: false,
      tool: "naabu, nmap",
      scriptPath: "/tools/recon/portscan.sh",
      outputPath: "/data/uber/stage3.json",
      findingsCount: 3,
      errorMessage: null,
      createdAt: "2026-09-19T11:40:00Z"
    },
    {
      id: "job-s4",
      programId: program.id,
      stage: 4,
      status: "queued",
      startedAt: null,
      finishedAt: null,
      triggeredBy: mockHunter,
      triggeredByScheduler: true,
      tool: "katana, gau",
      scriptPath: "/tools/recon/crawler.sh",
      outputPath: "/data/uber/stage4.json",
      findingsCount: 0,
      errorMessage: null,
      createdAt: "2026-09-19T12:00:00Z"
    },
    {
      id: "job-s5",
      programId: program.id,
      stage: 5,
      status: "queued",
      startedAt: null,
      finishedAt: null,
      triggeredBy: mockHunter,
      triggeredByScheduler: false,
      tool: "nuclei",
      scriptPath: "/tools/recon/nuclei.sh",
      outputPath: "/data/uber/stage5.json",
      findingsCount: 0,
      errorMessage: null,
      createdAt: "2026-09-19T12:05:00Z"
    }
  ])

  const [subdomains, setSubdomains] = useState<Subdomain[]>([
    {
      id: "sub-1",
      programId: program.id,
      rootDomain: "uber.com",
      subdomain: "auth.uber.com",
      ipAddress: "104.16.85.20",
      statusCode: 200,
      title: "Uber Single Sign-On",
      webServer: "cloudflare",
      techStack: ["React", "Cloudflare", "OpenID"],
      cdn: true,
      cdnProvider: "Cloudflare",
      isNew: false,
      isAlive: true,
      screenshotPath: "/mock-screen-1.png",
      firstSeen: "2026-02-10",
      lastSeen: "10m ago"
    },
    {
      id: "sub-2",
      programId: program.id,
      rootDomain: "uber.com",
      subdomain: "api.uber.com",
      ipAddress: "104.16.86.20",
      statusCode: 403,
      title: "Direct API Gateway",
      webServer: "envoy",
      techStack: ["Envoy", "gRPC", "REST"],
      cdn: true,
      cdnProvider: "Cloudflare",
      isNew: false,
      isAlive: true,
      screenshotPath: "/mock-screen-2.png",
      firstSeen: "2026-02-10",
      lastSeen: "15m ago"
    },
    {
      id: "sub-3",
      programId: program.id,
      rootDomain: "uber.com",
      subdomain: "internal-metrics.staging.uber.com",
      ipAddress: "198.51.100.42",
      statusCode: 401,
      title: "Prometheus Dashboard - Staging",
      webServer: "nginx/1.22.1",
      techStack: ["Prometheus", "Nginx", "Grafana"],
      cdn: false,
      cdnProvider: null,
      isNew: true,
      isAlive: true,
      screenshotPath: "/mock-screen-3.png",
      firstSeen: "Today",
      lastSeen: "20m ago"
    },
    {
      id: "sub-4",
      programId: program.id,
      rootDomain: "ubereats.com",
      subdomain: "restaurant-portal.ubereats.com",
      ipAddress: "151.101.65.140",
      statusCode: 200,
      title: "Uber Eats Restaurant Management",
      webServer: "Fastly",
      techStack: ["React", "Fastly", "Next.js"],
      cdn: true,
      cdnProvider: "Fastly",
      isNew: false,
      isAlive: true,
      screenshotPath: "/mock-screen-4.png",
      firstSeen: "2026-02-12",
      lastSeen: "1h ago"
    },
    {
      id: "sub-5",
      programId: program.id,
      rootDomain: "uber.com",
      subdomain: "dev-cluster01.corp.uber.com",
      ipAddress: "192.0.2.78",
      statusCode: 502,
      title: "Bad Gateway",
      webServer: "cloudflare",
      techStack: ["Cloudflare"],
      cdn: true,
      cdnProvider: "Cloudflare",
      isNew: true,
      isAlive: false,
      screenshotPath: null,
      firstSeen: "Today",
      lastSeen: "3h ago"
    }
  ])

  const ports: Port[] = [
    { id: "p-1", subdomainId: "sub-1", port: 443, protocol: "tcp", service: "https", version: "TLSv1.3", banner: "HTTP/2 200 OK", firstSeen: "2026-02-10", lastSeen: "10m ago" },
    { id: "p-2", subdomainId: "sub-1", port: 80, protocol: "tcp", service: "http", version: null, banner: "301 Moved Permanently", firstSeen: "2026-02-10", lastSeen: "10m ago" },
    { id: "p-3", subdomainId: "sub-2", port: 443, protocol: "tcp", service: "https", version: "Envoy proxy", banner: "HTTP/2 403 Forbidden", firstSeen: "2026-02-10", lastSeen: "15m ago" },
    { id: "p-4", subdomainId: "sub-3", port: 9090, protocol: "tcp", service: "prometheus", version: "2.45.0", banner: "Prometheus Metrics Exporter", firstSeen: "Today", lastSeen: "20m ago" },
    { id: "p-5", subdomainId: "sub-3", port: 80, protocol: "tcp", service: "http", version: "nginx/1.22.1", banner: "nginx", firstSeen: "Today", lastSeen: "20m ago" },
    { id: "p-6", subdomainId: "sub-4", port: 443, protocol: "tcp", service: "https", version: "Fastly", banner: "HTTP/2 200 OK", firstSeen: "2026-02-12", lastSeen: "1h ago" }
  ]

  const urls: DiscoveredUrl[] = [
    { id: "u-1", subdomainId: "sub-1", url: "https://auth.uber.com/v2/authorize?client_id=web", method: "GET", statusCode: 200, contentLength: 14502, source: "crawler", params: ["client_id", "response_type", "redirect_uri"], foundAt: "1h ago" },
    { id: "u-2", subdomainId: "sub-1", url: "https://auth.uber.com/api/v1/sessions/verify", method: "POST", statusCode: 400, contentLength: 204, source: "crawler", params: ["session_token"], foundAt: "1h ago" },
    { id: "u-3", subdomainId: "sub-3", url: "http://internal-metrics.staging.uber.com:9090/api/v1/query?query=up", method: "GET", statusCode: 200, contentLength: 890, source: "naabu", params: ["query", "time"], foundAt: "25m ago" },
    { id: "u-4", subdomainId: "sub-3", url: "http://internal-metrics.staging.uber.com:9090/metrics", method: "GET", statusCode: 200, contentLength: 48920, source: "gau", params: [], foundAt: "20m ago" },
    { id: "u-5", subdomainId: "sub-4", url: "https://restaurant-portal.ubereats.com/api/orders/export", method: "POST", statusCode: 401, contentLength: 120, source: "katana", params: ["store_id", "format"], foundAt: "45m ago" }
  ]

  const [findings, setFindings] = useState<Finding[]>([
    {
      id: "fnd-101",
      programId: program.id,
      subdomainId: "sub-3",
      urlId: "u-3",
      title: "Exposed Prometheus Metrics API with Unauthenticated Staging Telemetry",
      description: "Prometheus server on port 9090 was found publicly accessible without authentication, exposing internal cluster metrics and service topologies.",
      templateId: "cve-prometheus-metrics-unauth",
      templateName: "Prometheus Metrics Exposure",
      tool: "nuclei",
      severity: "high",
      cvssScore: 7.5,
      cveId: null,
      request: "GET /api/v1/query?query=up HTTP/1.1\nHost: internal-metrics.staging.uber.com:9090\nUser-Agent: BountyOS-Scanner/1.0",
      response: "HTTP/1.1 200 OK\nContent-Type: application/json\n\n{\"status\":\"success\",\"data\":{\"resultType\":\"vector\",\"result\":[{\"metric\":{\"__name__\":\"up\",\"job\":\"kubernetes-nodes\"},\"value\":[1726743600,\"1\"]}]}}",
      curlCommand: "curl -ik -s 'http://internal-metrics.staging.uber.com:9090/api/v1/query?query=up'",
      evidencePaths: [],
      screenshotPath: null,
      status: "triaged",
      assignedTo: mockHunter,
      foundAt: "2026-09-19T11:42:00Z",
      triagedAt: "2026-09-19T11:45:00Z",
      validatedAt: null,
      submittedAt: null,
      bountyAmount: null,
      notes: "Valid staging leak. Verify if internal IP addresses or auth tokens are reflected in metrics labels.",
      reportPath: null,
      program: program
    },
    {
      id: "fnd-102",
      programId: program.id,
      subdomainId: "sub-1",
      urlId: "u-1",
      title: "Open Redirect in OAuth Callback Parameter redirect_uri",
      description: "The OAuth authorization flow allows arbitrary parameter pollution causing redirection to attacker domains when validating malformed schemeless URIs.",
      templateId: "oauth-redirect-validation",
      templateName: "OAuth Redirect Bypass",
      tool: "manual",
      severity: "medium",
      cvssScore: 6.1,
      cveId: null,
      request: "GET /v2/authorize?client_id=web&redirect_uri=https://auth.uber.com.attacker.com/callback HTTP/1.1\nHost: auth.uber.com",
      response: "HTTP/1.1 302 Found\nLocation: https://auth.uber.com.attacker.com/callback?code=xyz\nSet-Cookie: session_auth=...",
      curlCommand: "curl -ik 'https://auth.uber.com/v2/authorize?client_id=web&redirect_uri=https://auth.uber.com.attacker.com/callback'",
      evidencePaths: [],
      screenshotPath: null,
      status: "validated",
      assignedTo: mockHunter,
      foundAt: "2026-09-18T14:15:00Z",
      triagedAt: "2026-09-18T14:30:00Z",
      validatedAt: "2026-09-18T15:00:00Z",
      submittedAt: null,
      bountyAmount: null,
      notes: "Confirmed on Chrome and Safari. POC ready for submission.",
      reportPath: null,
      program: program
    },
    {
      id: "fnd-103",
      programId: program.id,
      subdomainId: "sub-4",
      urlId: "u-5",
      title: "Broken Object Level Authorization (BOLA) in Restaurant Orders Export",
      description: "Manipulating store_id in /api/orders/export yields full transaction details for other restaurant partners without permission check.",
      templateId: "api-bola-id-check",
      templateName: "BOLA / IDOR Verification",
      tool: "manual",
      severity: "critical",
      cvssScore: 9.1,
      cveId: null,
      request: "POST /api/orders/export HTTP/1.1\nHost: restaurant-portal.ubereats.com\nAuthorization: Bearer <TOKEN_STORE_A>\nContent-Type: application/json\n\n{\"store_id\": \"STORE_B_UUID\", \"format\": \"csv\"}",
      response: "HTTP/1.1 200 OK\nContent-Type: text/csv\n\norder_id,customer_name,total,address\n9812,John Doe,$44.20,123 Main St",
      curlCommand: "curl -ik -X POST 'https://restaurant-portal.ubereats.com/api/orders/export' -H 'Authorization: Bearer ...' -d '{\"store_id\":\"STORE_B_UUID\"}'",
      evidencePaths: [],
      screenshotPath: null,
      status: "new",
      assignedTo: null,
      foundAt: "2026-09-19T09:10:00Z",
      triagedAt: null,
      validatedAt: null,
      submittedAt: null,
      bountyAmount: null,
      notes: "Critical risk. High likelihood of maximum bounty payout ($15,000+). Needs prompt triage and report generation.",
      reportPath: null,
      program: program
    }
  ])

  // Handlers
  async function handleApproveActive(id: string) {
    setProgram((prev) => ({ ...prev, activeApproved: true }))
    toast({ title: "Active scanning approved", description: "Stages 3 & 4 unlocked for automated scanning." })
  }

  async function handleAddScopeTarget(newTarget: {
    targetType: ScopeType
    targetValue: string
    inScope: boolean
    notes?: string
  }) {
    const created: ScopeTarget = {
      id: `tgt-${Date.now()}`,
      programId: program.id,
      targetType: newTarget.targetType,
      targetValue: newTarget.targetValue,
      inScope: newTarget.inScope,
      notes: newTarget.notes || null,
      addedBy: mockHunter,
      addedAt: new Date().toISOString()
    }
    setTargets((prev) => [created, ...prev])
    toast({ title: "Scope target added", description: `${created.targetValue} added to scope.` })
  }

  async function handleRemoveScopeTarget(id: string) {
    setTargets((prev) => prev.filter((t) => t.id !== id))
    toast({ title: "Scope target removed", description: "Target removed from program scope." })
  }

  function handleTriggerScan(stageName: string, stageNumber?: number) {
    setScanMenuOpen(false)
    if (!program.activeApproved && stageNumber && stageNumber >= 3) {
      toast({ variant: "destructive", title: "Action Blocked", description: "Active scanning not approved for this program. Approve active scanning first." })
      return
    }

    const newJob: ScanJob = {
      id: `job-${Date.now()}`,
      programId: program.id,
      stage: (stageNumber || 1) as 1 | 2 | 3 | 4 | 5,
      status: "running",
      startedAt: "Just now",
      finishedAt: null,
      triggeredBy: mockHunter,
      triggeredByScheduler: false,
      tool: stageName.toLowerCase().includes("vuln") ? "nuclei" : "recon-engine",
      scriptPath: `/tools/recon/${stageName.toLowerCase().replace(/[^a-z0-9]/g, "")}.sh`,
      outputPath: `/data/scans/${Date.now()}.json`,
      findingsCount: 0,
      errorMessage: null,
      createdAt: new Date().toISOString()
    }

    setJobs((prev) => [newJob, ...prev])
    toast({ title: "Scan Dispatched", description: `Dispatched scan: ${stageName}` })
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    setProgram((prev) => ({
      ...prev,
      name: editName,
      programUrl: editUrl || null,
      notes: editNotes || null,
      bountyRangeLow: parseFloat(editMinBounty) || 0,
      bountyRangeHigh: parseFloat(editMaxBounty) || 0
    }))
    setEditModalOpen(false)
    toast({ title: "Program updated", description: "Program settings saved successfully." })
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <button onClick={() => router.push("/projects")} className="hover:text-primary transition-colors">
            Projects
          </button>
          <span>/</span>
          <button onClick={() => router.push(`/projects/${program.projectId}`)} className="hover:text-primary transition-colors">
            H1 Private Programs
          </button>
          <span>/</span>
          <span className="text-text-secondary font-medium">{program.name}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center text-2xl font-bold text-primary shadow-glow-primary/20 shrink-0">
              {program.name.charAt(0)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-text-primary tracking-tight">
                  {program.name}
                </h1>
                <span className="badge uppercase tracking-wider bg-primary-muted text-primary text-[10px] font-semibold">
                  {program.platform}
                </span>
                <span className={cn(
                  "badge text-[10px] font-semibold",
                  program.status === "active" ? "bg-low-muted text-low" : "bg-medium-muted text-medium"
                )}>
                  {program.status.toUpperCase()}
                </span>
                {program.activeApproved ? (
                  <span className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Active Scanning Approved
                  </span>
                ) : (
                  <span className="badge bg-high-muted text-high border border-high/30 text-[10px] font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Passive Only
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-text-muted">
                {program.programUrl && (
                  <a
                    href={program.programUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-primary transition-colors inline-flex items-center gap-1"
                  >
                    {program.programUrl} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <span>•</span>
                <span>Bounties: ${program.bountyRangeLow?.toLocaleString()} - ${program.bountyRangeHigh?.toLocaleString()} {program.currency}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            {/* Scan Now Menu */}
            <div className="relative">
              <button
                onClick={() => setScanMenuOpen(!scanMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-primary rounded-xl text-white text-xs font-semibold hover:bg-primary-hover transition-all shadow-glow-primary active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Scan Target <ChevronDown className="w-3 h-3" />
              </button>
              {scanMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-border bg-bg-elevated shadow-2xl py-1.5 z-20 animate-in fade-in slide-in-from-top-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    Trigger Pipeline Scan
                  </div>
                  {[
                    { name: "Stage 1 — Passive Recon", stage: 1 },
                    { name: "Stage 2 — Validation & DNS", stage: 2 },
                    { name: "Stage 3 — Port Discovery", stage: 3 },
                    { name: "Stage 4 — Crawl & Content", stage: 4 },
                    { name: "Stage 5 — Vulnerabilities", stage: 5 },
                  ].map((s) => (
                    <button
                      key={s.name}
                      onClick={() => handleTriggerScan(s.name, s.stage)}
                      className="w-full px-3 py-2 text-xs text-left text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-colors flex items-center justify-between"
                    >
                      <span>{s.name}</span>
                      <span className="text-[10px] text-text-muted">Stage {s.stage}</span>
                    </button>
                  ))}
                  <div className="border-t border-border/60 my-1" />
                  <button
                    onClick={() => handleTriggerScan("Full Pipeline Scan", 1)}
                    className="w-full px-3 py-2 text-xs text-left text-accent hover:bg-accent-muted transition-colors font-medium flex items-center gap-1.5"
                  >
                    <Play className="w-3 h-3" /> Run Full Pipeline
                  </button>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(true)}
              className="rounded-xl border-border bg-bg-elevated hover:bg-bg-overlay text-text-primary text-xs"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          </div>
        </div>

        {/* Approval Gate Banner */}
        <ApprovalGateBanner
          programId={program.id}
          isApproved={program.activeApproved}
          onApprove={handleApproveActive}
        />
      </header>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border">
        {[
          { label: "Overview", icon: Layers },
          { label: `Scope (${targets.length})`, icon: Shield },
          { label: `Recon Assets (${subdomains.length})`, icon: Globe },
          { label: `Findings (${findings.length})`, icon: Bug },
          { label: "Report Generator", icon: FileText }
        ].map((tab, i) => {
          const Icon = tab.icon
          const isActive = activeTab === i
          return (
            <button
              key={tab.label}
              onClick={() => setActiveTab(i)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-all duration-150 border-b-2 -mb-px",
                isActive
                  ? "text-primary border-primary bg-primary/5"
                  : "text-text-muted hover:text-text-primary border-transparent hover:border-border"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab 0: Overview */}
      {activeTab === 0 && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted font-medium">Subdomains</span>
                <div className="w-8 h-8 rounded-lg bg-primary-muted text-primary flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-text-primary mt-2">{subdomains.length}</div>
              <div className="text-[11px] text-text-muted mt-0.5">
                {subdomains.filter((s) => s.isAlive).length} live hosts
              </div>
            </div>

            <div className="card p-4 hover:border-accent/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted font-medium">Open Ports</span>
                <div className="w-8 h-8 rounded-lg bg-accent-muted text-accent flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-text-primary mt-2">{ports.length}</div>
              <div className="text-[11px] text-text-muted mt-0.5">Discovered services</div>
            </div>

            <div className="card p-4 hover:border-critical/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted font-medium">Findings</span>
                <div className="w-8 h-8 rounded-lg bg-critical-muted text-critical flex items-center justify-center">
                  <Bug className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-text-primary mt-2">{findings.length}</div>
              <div className="text-[11px] text-critical font-medium mt-0.5">
                {findings.filter((f) => f.severity === "critical" || f.severity === "high").length} high / critical
              </div>
            </div>

            <div className="card p-4 hover:border-low/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted font-medium">Crawler URLs</span>
                <div className="w-8 h-8 rounded-lg bg-low-muted text-low flex items-center justify-center">
                  <Link2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-text-primary mt-2">{urls.length}</div>
              <div className="text-[11px] text-text-muted mt-0.5">Endpoints mapped</div>
            </div>
          </div>

          {/* Pipeline Status Component */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Automated Pipeline Orchestration</h3>
                <p className="text-xs text-text-muted">Stages execute sequentially with automated safety gates.</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogModalJobId(jobs[0]?.id || "job-s1")}
                className="text-xs text-primary hover:bg-primary-muted gap-1.5"
              >
                <Terminal className="w-3.5 h-3.5" /> View Live Console
              </Button>
            </div>
            <PipelineStatus
              jobs={jobs}
              onViewLogs={(jobId) => setLogModalJobId(jobId)}
            />
          </div>

          {/* Top Unresolved Findings Card */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">Latest Program Findings</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab(3)}
                className="text-xs text-primary"
              >
                View All ({findings.length}) →
              </Button>
            </div>
            <div className="divide-y divide-border/40">
              {findings.map((f) => (
                <div
                  key={f.id}
                  onClick={() => router.push(`/findings/${f.id}`)}
                  className="py-3 flex items-center justify-between hover:bg-bg-overlay/50 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "badge text-[10px] uppercase font-bold",
                        f.severity === "critical" ? "bg-critical-muted text-critical border border-critical/30" :
                        f.severity === "high" ? "bg-high-muted text-high border border-high/30" :
                        "bg-medium-muted text-medium"
                      )}>
                        {f.severity}
                      </span>
                      <span className="text-sm font-medium text-text-primary hover:text-primary transition-colors">
                        {f.title}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted flex items-center gap-3">
                      <span>Tool: {f.tool || "Manual"}</span>
                      <span>•</span>
                      <span>Found {new Date(f.foundAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className="badge bg-bg-elevated border border-border text-xs text-text-secondary capitalize">
                    {f.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: Scope */}
      {activeTab === 1 && (
        <div className="space-y-4">
          <div className="bg-bg-elevated border border-border rounded-xl p-4 text-xs text-text-secondary leading-relaxed">
            <strong className="text-text-primary">Important Scope Guidance:</strong> Define wildcard domains, IP ranges, or mobile application packages. Automated scanners will strictly abide by in-scope and out-of-scope boundaries.
          </div>
          <ScopeEditor
            targets={targets}
            onAdd={handleAddScopeTarget}
            onRemove={handleRemoveScopeTarget}
          />
        </div>
      )}

      {/* Tab 2: Recon Sub-Tabs */}
      {activeTab === 2 && (
        <div className="space-y-4">
          {/* Sub-tab navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-bg-elevated rounded-xl border border-border w-fit">
            {[
              { id: "subdomains", label: `Subdomains (${subdomains.length})`, icon: Globe },
              { id: "ports", label: `Ports & Services (${ports.length})`, icon: Activity },
              { id: "urls", label: `Crawled URLs (${urls.length})`, icon: Link2 },
              { id: "screenshots", label: "Visual Grid", icon: ImageIcon }
            ].map((subTab) => {
              const Icon = subTab.icon
              const isSelected = reconSubTab === subTab.id
              return (
                <button
                  key={subTab.id}
                  onClick={() => setReconSubTab(subTab.id as any)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    isSelected
                      ? "bg-primary text-white shadow-glow-primary"
                      : "text-text-muted hover:text-text-primary hover:bg-bg-overlay"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {subTab.label}
                </button>
              )
            })}
          </div>

          {reconSubTab === "subdomains" && (
            <div className="card p-4">
              <SubdomainTable
                subdomains={subdomains}
                onSelect={(sub) => {
                  toast({ title: "Subdomain selected", description: `${sub.subdomain} (${sub.ipAddress || "no IP"})` })
                }}
              />
            </div>
          )}

          {reconSubTab === "ports" && (
            <div className="card p-4">
              <PortMap ports={ports} subdomains={subdomains} />
            </div>
          )}

          {reconSubTab === "urls" && (
            <div className="card p-4">
              <UrlTable urls={urls} />
            </div>
          )}

          {reconSubTab === "screenshots" && (
            <div className="card p-4">
              <ScreenshotGrid subdomains={subdomains} />
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Findings */}
      {activeTab === 3 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Program Findings</h2>
              <p className="text-xs text-text-muted">Security vulnerabilities identified across {program.name} assets.</p>
            </div>
            <Button
              size="sm"
              onClick={() => router.push("/findings")}
              className="bg-primary hover:bg-primary-hover text-white text-xs"
            >
              Global Findings Hub →
            </Button>
          </div>
          <FindingsTable
            findings={findings}
            onRowClick={(finding) => router.push(`/findings/${finding.id}`)}
          />
        </div>
      )}

      {/* Tab 4: Reports */}
      {activeTab === 4 && (
        <div className="card p-6">
          <ReportBuilder findings={findings} />
        </div>
      )}

      {/* Live Log Viewer Modal */}
      {logModalJobId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-text-primary">Scan Console & Live Logs</span>
                <span className="badge bg-primary-muted text-primary text-[10px] font-mono">{logModalJobId}</span>
              </div>
              <button
                onClick={() => setLogModalJobId(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-overlay"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto bg-black/60">
              <LiveLog jobId={logModalJobId} />
            </div>
            <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-text-muted">
              <span>Streaming stdout/stderr directly from orchestrator daemon</span>
              <Button size="sm" variant="ghost" onClick={() => setLogModalJobId(null)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Program Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-primary" />
                <h3 className="text-base font-semibold text-text-primary">Edit Program Details</h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-overlay"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Program Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-bg-subtle border-border text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Program URL</Label>
                <Input
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="bg-bg-subtle border-border text-xs"
                  placeholder="https://hackerone.com/..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-text-secondary">Min Bounty ($)</Label>
                  <Input
                    type="number"
                    value={editMinBounty}
                    onChange={(e) => setEditMinBounty(e.target.value)}
                    className="bg-bg-subtle border-border text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-text-secondary">Max Bounty ($)</Label>
                  <Input
                    type="number"
                    value={editMaxBounty}
                    onChange={(e) => setEditMaxBounty(e.target.value)}
                    className="bg-bg-subtle border-border text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Notes & Scope Instructions</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="bg-bg-subtle border-border text-xs min-h-[90px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-primary hover:bg-primary-hover text-white text-xs"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


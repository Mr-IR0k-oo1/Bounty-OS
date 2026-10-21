"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  AlertTriangle, ChevronDown, Activity, CheckCircle2, XCircle, Clock, 
  Play, Globe, Server, Shield, Bug, ExternalLink, Edit3, X, Terminal, 
  Layers, Link2, Image as ImageIcon, FileText, AlertCircle, RefreshCw 
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { api } from "@/lib/api"
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
import { useAuth } from "@/hooks/useAuth"
import type { 
  Program, ScopeTarget, ScopeType, Subdomain, Port, 
  DiscoveredUrl, Finding, ScanJob, Hunter 
} from "@/lib/types"

export default function ProgramDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { user } = useAuth()
  const currentHunter: Hunter = user || {
    id: "00000000-0000-0000-0000-000000000001",
    username: "admin",
    displayName: "Admin Hunter",
    role: "admin",
    totpEnabled: true,
    active: true,
    lastLogin: "Just now",
    createdAt: new Date().toISOString()
  }
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search)
      const tabParam = sp.get("tab")
      const tabMap: Record<string, number> = {
        overview: 0,
        scope: 1,
        recon: 2,
        findings: 3,
        reports: 4,
      }
      if (tabParam && tabMap[tabParam] !== undefined) {
        setActiveTab(tabMap[tabParam])
      }
    }
  }, [])

  const [reconSubTab, setReconSubTab] = useState<"subdomains" | "ports" | "urls" | "screenshots">("subdomains")
  const [scanMenuOpen, setScanMenuOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [logModalJobId, setLogModalJobId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [program, setProgram] = useState<Program>({
    id: params.id,
    projectId: "",
    slug: "",
    name: "Loading...",
    platform: "other",
    programUrl: null,
    status: "active",
    bountyRangeLow: null,
    bountyRangeHigh: null,
    currency: "USD",
    activeApproved: false,
    notes: null,
    rescanIntervalHrs: 24,
    lastScannedAt: null,
    createdAt: new Date().toISOString()
  })

  // Edit form state
  const [editName, setEditName] = useState("")
  const [editUrl, setEditUrl] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editMinBounty, setEditMinBounty] = useState("0")
  const [editMaxBounty, setEditMaxBounty] = useState("0")

  const [targets, setTargets] = useState<ScopeTarget[]>([])
  const [jobs, setJobs] = useState<ScanJob[]>([])
  const [subdomains, setSubdomains] = useState<Subdomain[]>([])
  const [ports, setPorts] = useState<Port[]>([])
  const [urls, setUrls] = useState<DiscoveredUrl[]>([])
  const [findings, setFindings] = useState<Finding[]>([])

  const fetchAllProgramData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prog, scopeList, subList, urlList, fList, jList] = await Promise.all([
        api.getProgram(params.id),
        api.listScope(params.id).catch(() => []),
        api.listSubdomains(params.id).catch(() => []),
        api.listUrls(params.id).catch(() => []),
        api.listProgramFindings(params.id).catch(() => []),
        api.listProgramJobs(params.id).catch(() => []),
      ])

      const isApproved = prog.activeApproved ?? prog.active_approved ?? false
      setProgram({
        ...prog,
        projectId: prog.projectId || prog.project_id || "",
        activeApproved: isApproved,
        active_approved: isApproved,
        status: prog.active !== false ? "active" : "archived",
      })
      setEditName(prog.name)
      setEditUrl(prog.programUrl || prog.program_url || "")
      setEditNotes(prog.notes || "")
      setEditMinBounty(String(prog.bountyRangeLow || 0))
      setEditMaxBounty(String(prog.bountyRangeHigh || 0))

      const normalizedTargets = scopeList.map((t: any) => ({
        ...t,
        targetType: (t.targetType || t.target_type || "domain") as ScopeType,
        targetValue: t.targetValue || t.target || "",
        inScope: t.inScope !== undefined ? t.inScope : !t.out_of_scope,
        addedBy: typeof t.addedBy === "object" && t.addedBy !== null ? t.addedBy : currentHunter,
        addedAt: t.addedAt || (t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString()),
      }))
      setTargets(normalizedTargets)

      const normalizedSubdomains = subList.map((s: any) => ({
        ...s,
        ipAddress: s.ipAddress ?? s.ip_address ?? null,
        statusCode: s.statusCode ?? s.status_code ?? null,
        webServer: s.webServer ?? s.web_server ?? null,
        techStack: s.techStack || s.tech || [],
        isAlive: s.isAlive ?? ((s.statusCode ?? s.status_code ?? 0) > 0),
        firstSeen: s.firstSeen || (s.created_at ? new Date(s.created_at).toLocaleDateString() : "Just now"),
        lastSeen: s.lastSeen || "Recently",
      }))
      setSubdomains(normalizedSubdomains)

      const normalizedUrls = urlList.map((u: any) => ({
        ...u,
        subdomainId: u.subdomainId || u.subdomain_id || "",
        statusCode: u.statusCode ?? u.status_code ?? 200,
        contentLength: u.contentLength ?? u.content_length ?? 0,
        foundAt: u.foundAt || "Recently",
      }))
      setUrls(normalizedUrls)

      const normalizedFindings = fList.map((f: any) => ({
        ...f,
        programId: f.programId || f.program_id || params.id,
        subdomainId: f.subdomainId || f.subdomain_id || null,
        urlId: f.urlId || f.url_id || null,
        severity: (f.severity || "info") as any,
        status: (f.status || "new") as any,
        foundAt: f.foundAt || (f.created_at ? new Date(f.created_at).toISOString() : new Date().toISOString()),
        program: prog,
      }))
      setFindings(normalizedFindings)
      setJobs(jList)
    } catch (e: any) {
      setError(e.message || "Failed to load program")
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchAllProgramData()
  }, [fetchAllProgramData])

  // Handlers
  async function handleApproveActive(id: string) {
    try {
      await api.approveProgram(id)
      setProgram((prev) => ({ ...prev, activeApproved: true, active_approved: true }))
      toast({ title: "Active scanning approved", description: "Stages 3 & 4 unlocked for automated scanning." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Approval failed", description: e.message })
    }
  }

  async function handleAddScopeTarget(newTarget: {
    targetType: ScopeType
    targetValue: string
    inScope: boolean
    notes?: string
  }) {
    try {
      const created = await api.addScope(program.id, {
        target: newTarget.targetValue,
        target_type: newTarget.targetType,
        out_of_scope: !newTarget.inScope,
        notes: newTarget.notes || null,
      })
      const normalized: ScopeTarget = {
        ...created,
        targetType: newTarget.targetType,
        targetValue: newTarget.targetValue,
        inScope: newTarget.inScope,
        notes: newTarget.notes || null,
        addedBy: currentHunter,
        addedAt: new Date().toISOString()
      }
      setTargets((prev) => [normalized, ...prev])
      toast({ title: "Scope target added", description: `${newTarget.targetValue} added to scope.` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to add scope", description: e.message })
    }
  }

  async function handleRemoveScopeTarget(id: string) {
    try {
      await api.deleteScope(id)
      setTargets((prev) => prev.filter((t) => t.id !== id))
      toast({ title: "Scope target removed", description: "Target removed from program scope." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to remove scope", description: e.message })
    }
  }

  async function handleTriggerScan(stageName: string, stageNumber?: number) {
    setScanMenuOpen(false)
    if (!program.activeApproved && !program.active_approved && stageNumber && stageNumber >= 3) {
      toast({ variant: "destructive", title: "Action Blocked", description: "Active scanning not approved for this program. Approve active scanning first." })
      return
    }

    try {
      await api.scanProgram(program.id)
      const newJob: ScanJob = {
        id: `job-${Date.now()}`,
        programId: program.id,
        stage: (stageNumber || 1) as 1 | 2 | 3 | 4 | 5,
        status: "running",
        startedAt: "Just now",
        finishedAt: null,
        triggeredBy: currentHunter,
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
    } catch (e: any) {
      toast({ variant: "destructive", title: "Scan dispatch failed", description: e.message })
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.updateProgram(program.id, {
        name: editName,
        programUrl: editUrl || null,
        notes: editNotes || null,
        bountyRangeLow: parseFloat(editMinBounty) || 0,
        bountyRangeHigh: parseFloat(editMaxBounty) || 0
      })
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
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e.message })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-bg-elevated border border-border rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-bg-elevated border border-border rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-bg-elevated border border-border rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-severity-critical/10 text-severity-critical mb-2">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-text-primary">Failed to load target program</h2>
        <p className="text-xs text-text-muted max-w-md mx-auto">{error}</p>
        <div className="flex justify-center gap-3 pt-2">
          <Button variant="ghost" onClick={() => router.push("/programs")} className="text-xs">
            Back to Programs
          </Button>
          <Button onClick={() => fetchAllProgramData()} className="btn-primary text-xs gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      </div>
    )
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
            Project
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
                  {(program.status || "active").toUpperCase()}
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
          isApproved={program.activeApproved ?? false}
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
              onClick={() => {
                setActiveTab(i)
                if (typeof window !== "undefined") {
                  const tabKeys = ["overview", "scope", "recon", "findings", "reports"]
                  const url = new URL(window.location.href)
                  url.searchParams.set("tab", tabKeys[i])
                  window.history.replaceState(null, "", url.toString())
                }
              }}
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
                      <span>Found {f.foundAt ? new Date(f.foundAt).toLocaleDateString() : (f.created_at ? new Date(f.created_at).toLocaleDateString() : "Recently")}</span>
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


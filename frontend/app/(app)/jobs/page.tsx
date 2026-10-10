"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Play,
  Square,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Terminal,
  X,
  RefreshCw,
  FolderArchive,
  AlertCircle,
  Shield,
  Layers,
  FileCode,
  Loader2,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { useJobs } from "@/hooks/useJobs"
import { api } from "@/lib/api"
import type { ScanJob, Program, ScopeTarget, JobLogs, JobArtifacts } from "@/lib/types"
import { LiveLog } from "@/components/recon/LiveLog"

const statusConfig: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>
    label: string
    color: string
    badgeBg: string
    border: string
  }
> = {
  running: {
    icon: Activity,
    label: "Running",
    color: "text-accent",
    badgeBg: "bg-accent-muted",
    border: "border-accent/20",
  },
  queued: {
    icon: Clock,
    label: "Queued",
    color: "text-text-muted",
    badgeBg: "bg-bg-subtle",
    border: "border-border",
  },
  done: {
    icon: CheckCircle2,
    label: "Succeeded",
    color: "text-low",
    badgeBg: "bg-low-muted",
    border: "border-low/20",
  },
  succeeded: {
    icon: CheckCircle2,
    label: "Succeeded",
    color: "text-low",
    badgeBg: "bg-low-muted",
    border: "border-low/20",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    color: "text-critical",
    badgeBg: "bg-critical-muted",
    border: "border-critical/20",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelled",
    color: "text-text-subtle",
    badgeBg: "bg-bg-subtle",
    border: "border-border",
  },
  timed_out: {
    icon: AlertTriangle,
    label: "Timed Out",
    color: "text-medium",
    badgeBg: "bg-medium-muted",
    border: "border-medium/20",
  },
}

const stageDisplayNames: Record<number, string> = {
  1: "Stage 1 — Passive Recon",
  2: "Stage 2 — Host Validation",
  3: "Stage 3 — Port Discovery",
  4: "Stage 4 — Crawl & Content",
  5: "Stage 5 — Vulnerabilities",
}

const allowedTools = [
  { id: "subfinder", name: "subfinder", stage: 1, desc: "Passive Subdomain Enumeration", activeReq: false },
  { id: "httpx", name: "httpx", stage: 2, desc: "Host Validation & HTTP Probing", activeReq: false },
  { id: "naabu", name: "naabu", stage: 3, desc: "Port Discovery (Requires Approval)", activeReq: true },
  { id: "katana", name: "katana", stage: 4, desc: "Crawling & Endpoint Discovery (Requires Approval)", activeReq: true },
  { id: "nuclei", name: "nuclei", stage: 4, desc: "Vulnerability Scanning (Requires Approval)", activeReq: true },
  { id: "gau", name: "gau", stage: 1, desc: "GetAllUrls Passive Archive Discovery", activeReq: false },
  { id: "waybackurls", name: "waybackurls", stage: 1, desc: "Wayback Machine Archive Discovery", activeReq: false },
]

function formatDuration(startedAt?: string | null, completedAt?: string | null, status?: string): string {
  if (!startedAt) return status === "queued" ? "Queued" : "—"
  const start = new Date(startedAt).getTime()
  if (isNaN(start)) return "—"

  if (completedAt) {
    const end = new Date(completedAt).getTime()
    if (isNaN(end)) return "—"
    const diffSecs = Math.max(0, Math.round((end - start) / 1000))
    const mins = Math.floor(diffSecs / 60)
    const secs = diffSecs % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  if (status === "running") {
    const now = Date.now()
    const diffSecs = Math.max(0, Math.round((now - start) / 1000))
    const mins = Math.floor(diffSecs / 60)
    const secs = diffSecs % 60
    return mins > 0 ? `${mins}m ${secs}s (live)` : `${secs}s (live)`
  }

  if (status === "cancelled") return "Stopped"
  return "—"
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "—"
  const time = new Date(dateStr).getTime()
  if (isNaN(time)) return "—"
  const diffSecs = Math.max(0, Math.round((Date.now() - time) / 1000))
  if (diffSecs < 60) return "Just now"
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export default function JobsPage() {
  const { toast } = useToast()
  const { jobs, loading, error, refetch, createJob, cancelJob, getJobLogs, getJobArtifacts } = useJobs()

  const [filter, setFilter] = useState("All")
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [expandedTab, setExpandedTab] = useState<"logs" | "discovered" | "artifacts" | "details">("logs")
  const [logsData, setLogsData] = useState<Record<string, JobLogs>>({})
  const [artifactsData, setArtifactsData] = useState<Record<string, JobArtifacts>>({})
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({})

  // Programs and Scope cache
  const [programs, setPrograms] = useState<Program[]>([])
  const [programScopeMap, setProgramScopeMap] = useState<Record<string, ScopeTarget[]>>({})

  // Dispatch scan modal
  const [newScanOpen, setNewScanOpen] = useState(false)
  const [selectedProgramId, setSelectedProgramId] = useState("")
  const [selectedTool, setSelectedTool] = useState("subfinder")
  const [selectedTarget, setSelectedTarget] = useState("")
  const [customTarget, setCustomTarget] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch programs for name resolution and creation modal
  useEffect(() => {
    async function loadPrograms() {
      try {
        const progs = await api.listPrograms()
        setPrograms(progs)
        if (progs.length > 0 && !selectedProgramId) {
          setSelectedProgramId(progs[0].id)
        }
      } catch {
        // Programs error handled if needed
      }
    }
    loadPrograms()
  }, [selectedProgramId])

  // Fetch scope when selected program changes
  useEffect(() => {
    if (!selectedProgramId) return
    async function loadScope() {
      try {
        const targets = await api.listScope(selectedProgramId)
        setProgramScopeMap((prev) => ({ ...prev, [selectedProgramId]: targets }))
        const inScopeTargets = targets.filter((t) => t.inScope !== false && !t.out_of_scope)
        if (inScopeTargets.length > 0) {
          const firstTarget = inScopeTargets[0].targetValue || inScopeTargets[0].target || ""
          setSelectedTarget(firstTarget)
        } else {
          setSelectedTarget("")
        }
      } catch {
        // Scope target error handled gracefully
      }
    }
    loadScope()
  }, [selectedProgramId])

  const programsMap = programs.reduce<Record<string, Program>>((acc, p) => {
    acc[p.id] = p
    return acc
  }, {})

  // Fetch details (logs & artifacts) when expanding a job
  const handleToggleExpand = useCallback(
    async (jobId: string) => {
      if (expandedJobId === jobId) {
        setExpandedJobId(null)
        return
      }

      setExpandedJobId(jobId)
      setLoadingDetails((prev) => ({ ...prev, [jobId]: true }))

      try {
        const [logs, artifacts] = await Promise.all([
          getJobLogs(jobId).catch(() => ({
            job_id: jobId,
            stdout: "[Unable to load stdout log from server]",
            stderr: "",
            exit_code: null,
            status: "unknown",
          })),
          getJobArtifacts(jobId).catch(() => ({
            job_id: jobId,
            available: false,
            files: [],
            evidence_path: null,
            message: "Unable to reach artifact service.",
          })),
        ])

        setLogsData((prev) => ({ ...prev, [jobId]: logs }))
        setArtifactsData((prev) => ({ ...prev, [jobId]: artifacts }))
      } finally {
        setLoadingDetails((prev) => ({ ...prev, [jobId]: false }))
      }
    },
    [expandedJobId, getJobLogs, getJobArtifacts]
  )

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    if (expandedJobId) {
      try {
        const [logs, artifacts] = await Promise.all([
          getJobLogs(expandedJobId),
          getJobArtifacts(expandedJobId),
        ])
        setLogsData((prev) => ({ ...prev, [expandedJobId]: logs }))
        setArtifactsData((prev) => ({ ...prev, [expandedJobId]: artifacts }))
      } catch {
        // Refresh error swallowed
      }
    }
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const handleStopJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await cancelJob(jobId)
      toast({ title: "Job Cancelled", description: `Scan job ${jobId} was stopped.` })
      if (expandedJobId === jobId) {
        const logs = await getJobLogs(jobId)
        setLogsData((prev) => ({ ...prev, [jobId]: logs }))
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Cancel Failed",
        description: err.message || "Failed to cancel job",
      })
    }
  }

  const handleLaunchScan = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)

    const finalTarget = customTarget.trim() || selectedTarget.trim()
    if (!finalTarget) {
      setModalError("A target must be specified or chosen from program scope.")
      return
    }

    if (!selectedProgramId) {
      setModalError("Please select a target program.")
      return
    }

    const toolObj = allowedTools.find((t) => t.id === selectedTool)
    const prog = programsMap[selectedProgramId]

    setIsSubmitting(true)

    try {
      const created = await createJob({
        program_id: selectedProgramId,
        tool: selectedTool,
        target: finalTarget,
        stage: toolObj?.stage || 1,
      })

      setNewScanOpen(false)
      setCustomTarget("")
      toast({
        title: "Scan Dispatched",
        description: `Started ${selectedTool} against ${finalTarget}.`,
      })
      setExpandedJobId(created.id)
    } catch (err: any) {
      setModalError(err.message || "Backend rejected scan job creation.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter configuration
  const filters = ["All", "Running", "Queued", "Done", "Failed", "Cancelled", "Timed Out"]

  const runningCount = jobs.filter((j) => j.status === "running").length
  const queuedCount = jobs.filter((j) => j.status === "queued").length

  const filteredJobs = jobs.filter((job) => {
    if (filter === "All") return true
    if (filter === "Running") return job.status === "running"
    if (filter === "Queued") return job.status === "queued"
    if (filter === "Done") return job.status === "done" || job.status === "succeeded"
    if (filter === "Failed") return job.status === "failed"
    if (filter === "Cancelled") return job.status === "cancelled"
    if (filter === "Timed Out") return job.status === "timed_out"
    return true
  })

  // Selected program for modal
  const selectedProg = programsMap[selectedProgramId]
  const selectedScopeList = programScopeMap[selectedProgramId] || []
  const selectedToolObj = allowedTools.find((t) => t.id === selectedTool)
  const isSelectedActiveTool = selectedToolObj?.activeReq ?? false
  const effectiveTarget = customTarget.trim() || selectedTarget

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2.5">
            Orchestrated Security Jobs
            {runningCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent-muted text-accent border border-accent/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                {runningCount} Running
              </span>
            )}
            {queuedCount > 0 && (
              <span className="text-xs font-normal text-text-muted">({queuedCount} queued)</span>
            )}
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Real-time security runner orchestration, isolated execution workers, and evidence output.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="text-xs border-border bg-bg-elevated hover:bg-bg-overlay gap-1.5"
            title="Refresh Jobs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setModalError(null)
              setNewScanOpen(true)
            }}
            className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-glow-primary"
            size="sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Dispatch New Scan
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-bg-elevated border border-border w-fit">
        {filters.map((f) => {
          let count = 0
          if (f === "All") count = jobs.length
          else if (f === "Running") count = jobs.filter((j) => j.status === "running").length
          else if (f === "Queued") count = jobs.filter((j) => j.status === "queued").length
          else if (f === "Done")
            count = jobs.filter((j) => j.status === "done" || j.status === "succeeded").length
          else if (f === "Failed") count = jobs.filter((j) => j.status === "failed").length
          else if (f === "Cancelled") count = jobs.filter((j) => j.status === "cancelled").length
          else if (f === "Timed Out") count = jobs.filter((j) => j.status === "timed_out").length

          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5",
                filter === f
                  ? "bg-primary text-white shadow-glow-primary"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-overlay"
              )}
            >
              <span>{f}</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full",
                  filter === f ? "bg-white/20 text-white" : "bg-bg-subtle text-text-muted"
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-critical/30 bg-critical-muted/50 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-critical flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-critical">Failed to load jobs from runner</h4>
            <p className="text-xs text-text-muted mt-1">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="text-xs border-critical/30 text-critical hover:bg-critical-muted"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Jobs Content Table */}
      <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden shadow-sm">
        {loading && jobs.length === 0 ? (
          <div className="p-8 space-y-4">
            <div className="flex items-center justify-center gap-2 text-text-muted text-sm py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              Loading security jobs from runner...
            </div>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-bg-subtle flex items-center justify-center mx-auto mb-3 border border-border">
              <Layers className="w-6 h-6 text-text-muted" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">No jobs found</h3>
            <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
              {filter !== "All"
                ? `There are currently no jobs with status "${filter}".`
                : "No security jobs have been dispatched yet. Choose an authorized target and start your first scan."}
            </p>
            {filter === "All" && (
              <Button
                onClick={() => setNewScanOpen(true)}
                className="mt-4 bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
                size="sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Dispatch First Scan
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle/50 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Target</th>
                  <th className="px-4 py-3 text-left">Program</th>
                  <th className="px-4 py-3 text-left">Tool</th>
                  <th className="px-4 py-3 text-left">Pipeline Stage</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredJobs.map((job) => {
                  const statusKey = job.status.toLowerCase()
                  const config = statusConfig[statusKey] || statusConfig.queued
                  const Icon = config.icon
                  const expanded = expandedJobId === job.id

                  const programId = job.program_id || job.programId || ""
                  const prog = programsMap[programId]
                  const programName = prog?.name || (job.program?.name ?? "Unknown Program")

                  const toolName =
                    job.tool ||
                    (job.flags && typeof job.flags === "object" ? (job.flags as any).tool : null) ||
                    "recon-engine"

                  const targetDisplay =
                    job.target ||
                    (job.flags && typeof job.flags === "object" ? (job.flags as any).target : null) ||
                    "—"

                  const stageNum = Number(job.stage) || 1
                  const stageName = stageDisplayNames[stageNum] || `Stage ${stageNum}`

                  const startedTime = job.started_at || job.startedAt
                  const completedTime = job.completed_at || job.finishedAt
                  const createdTime = job.created_at || job.createdAt

                  const durationText = formatDuration(startedTime, completedTime, job.status)
                  const relativeTime = formatRelativeTime(createdTime || startedTime)

                  const logs = logsData[job.id]
                  const artifacts = artifactsData[job.id]
                  const isLoadingDetails = loadingDetails[job.id]

                  const exitCode =
                    logs?.exit_code ??
                    (job.flags && typeof job.flags === "object" ? (job.flags as any).exit_code : null)

                  return (
                    <div key={job.id} className="contents">
                      <tr
                        onClick={() => handleToggleExpand(job.id)}
                        className={cn(
                          "cursor-pointer transition-colors",
                          expanded ? "bg-bg-overlay/60" : "hover:bg-bg-overlay/40"
                        )}
                      >
                        {/* Status */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {job.status === "running" ? (
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
                              </span>
                            ) : (
                              <Icon className={cn("w-4 h-4", config.color)} />
                            )}
                            <span className={cn("text-xs font-semibold capitalize", config.color)}>
                              {config.label}
                            </span>
                          </div>
                        </td>

                        {/* Target */}
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs text-text-primary font-medium">
                            {targetDisplay}
                          </span>
                        </td>

                        {/* Program */}
                        <td className="px-4 py-3.5 text-xs font-medium text-text-secondary whitespace-nowrap">
                          {programName}
                        </td>

                        {/* Tool */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-bg-subtle text-text-primary font-mono text-[11px] border border-border/80">
                            {toolName}
                          </span>
                        </td>

                        {/* Stage */}
                        <td className="px-4 py-3.5 text-xs text-text-secondary whitespace-nowrap">
                          {stageName}
                        </td>

                        {/* Created / Started */}
                        <td className="px-4 py-3.5 text-xs text-text-muted whitespace-nowrap">
                          {relativeTime}
                        </td>

                        {/* Duration */}
                        <td className="px-4 py-3.5 text-xs text-text-muted font-mono whitespace-nowrap">
                          {durationText}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleExpand(job.id)
                              }}
                              className={cn(
                                "p-1.5 rounded-lg border text-xs transition-colors",
                                expanded
                                  ? "bg-primary text-white border-primary"
                                  : "bg-bg-subtle border-border text-text-muted hover:text-text-primary"
                              )}
                              title="Toggle Job Console and Details"
                            >
                              <Terminal className="w-3.5 h-3.5" />
                            </button>

                            {(job.status === "running" || job.status === "queued") && (
                              <button
                                onClick={(e) => handleStopJob(job.id, e)}
                                className="p-1.5 rounded-lg border border-critical/30 bg-critical-muted text-critical hover:bg-critical/20 transition-colors"
                                title="Stop / Cancel Scan Job"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Details and Logs */}
                      {expanded && (
                        <tr className="bg-bg-base/70">
                          <td colSpan={8} className="p-4">
                            <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden shadow-inner">
                              {/* Top Bar of Expanded View */}
                              <div className="px-4 py-3 border-b border-border bg-bg-subtle/80 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                                    <Terminal className="w-4 h-4 text-primary" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-text-primary">
                                        Job {job.id}
                                      </span>
                                      <span
                                        className={cn(
                                          "text-[10px] px-2 py-0.5 rounded-full font-semibold border",
                                          config.badgeBg,
                                          config.color,
                                          config.border
                                        )}
                                      >
                                        {config.label}
                                      </span>
                                      {/* Exit Code Pill */}
                                      {exitCode !== null && exitCode !== undefined ? (
                                        <span
                                          className={cn(
                                            "text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold border",
                                            exitCode === 0
                                              ? "bg-low-muted text-low border-low/20"
                                              : "bg-critical-muted text-critical border-critical/20"
                                          )}
                                        >
                                          Exit Code: {exitCode} {exitCode === 0 ? "(Clean)" : "(Error)"}
                                        </span>
                                      ) : job.status === "running" ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-accent-muted text-accent border border-accent/20">
                                          Process Active
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="text-[11px] text-text-muted mt-0.5">
                                      {programName} &bull; {toolName} &bull; Target:{" "}
                                      <span className="font-mono text-text-secondary">{targetDisplay}</span>
                                    </p>
                                  </div>
                                </div>

                                {/* Tabs inside expansion */}
                                <div className="flex items-center gap-1 bg-bg-base p-1 rounded-lg border border-border">
                                  <button
                                    onClick={() => setExpandedTab("logs")}
                                    className={cn(
                                      "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                                      expandedTab === "logs"
                                        ? "bg-primary text-white"
                                        : "text-text-muted hover:text-text-primary"
                                    )}
                                  >
                                    Console Output
                                  </button>
                                  <button
                                    onClick={() => setExpandedTab("discovered")}
                                    className={cn(
                                      "px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
                                      expandedTab === "discovered"
                                        ? "bg-primary text-white"
                                        : "text-text-muted hover:text-text-primary"
                                    )}
                                  >
                                    <span>Discovered Hosts</span>
                                    {Array.isArray((job.flags as any)?.subdomains) && (
                                      <span
                                        className={cn(
                                          "text-[10px] px-1.5 py-0.2 rounded-full",
                                          expandedTab === "discovered"
                                            ? "bg-white/20 text-white"
                                            : "bg-bg-subtle text-text-muted"
                                        )}
                                      >
                                        {(job.flags as any).subdomains.length}
                                      </span>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setExpandedTab("artifacts")}
                                    className={cn(
                                      "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                                      expandedTab === "artifacts"
                                        ? "bg-primary text-white"
                                        : "text-text-muted hover:text-text-primary"
                                    )}
                                  >
                                    Evidence & Artifacts
                                  </button>
                                  <button
                                    onClick={() => setExpandedTab("details")}
                                    className={cn(
                                      "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                                      expandedTab === "details"
                                        ? "bg-primary text-white"
                                        : "text-text-muted hover:text-text-primary"
                                    )}
                                  >
                                    Parameters
                                  </button>
                                </div>
                              </div>

                              {/* Tab Content */}
                              <div className="p-4">
                                {isLoadingDetails ? (
                                  <div className="flex items-center justify-center gap-2 py-10 text-xs text-text-muted">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    Retrieving job logs and artifact metadata from server...
                                  </div>
                                ) : expandedTab === "discovered" ? (
                                  <div className="space-y-4">
                                    {/* Summary Header */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-bg-subtle">
                                      <div className="flex items-center gap-4 text-xs font-mono">
                                        <div>
                                          <span className="text-text-muted">Domain Queried: </span>
                                          <span className="text-text-primary font-bold">{targetDisplay}</span>
                                        </div>
                                        <div>
                                          <span className="text-text-muted">Discovered: </span>
                                          <span className="text-primary font-bold">
                                            {(job.flags as any)?.discovered_count ??
                                              (Array.isArray((job.flags as any)?.subdomains)
                                                ? (job.flags as any).subdomains.length
                                                : 0)}{" "}
                                            unique hostnames
                                          </span>
                                        </div>
                                        {(job.flags as any)?.tool_version && (
                                          <div>
                                            <span className="text-text-muted">Tool Version: </span>
                                            <span className="text-text-secondary">
                                              {(job.flags as any).tool_version}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <a
                                          href={`/programs/${programId}/recon`}
                                          className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                                        >
                                          View in Program Recon <ExternalLink className="w-3 h-3" />
                                        </a>
                                      </div>
                                    </div>

                                    {/* Failure or Tool Unavailable Alert */}
                                    {job.status === "failed" && (job.error_log || logs?.stderr) && (
                                      <div className="p-3 rounded-xl border border-critical/30 bg-critical-muted text-xs text-critical flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <div>
                                          <strong>Reconnaissance Error: </strong>
                                          {job.error_log || logs?.stderr}
                                        </div>
                                      </div>
                                    )}

                                    {/* Discovered Subdomains List */}
                                    {Array.isArray((job.flags as any)?.subdomains) &&
                                    (job.flags as any).subdomains.length > 0 ? (
                                      <div className="rounded-lg border border-border overflow-hidden bg-bg-base">
                                        <div className="px-3 py-2 border-b border-border text-[11px] font-semibold text-text-muted flex items-center justify-between">
                                          <span>Normalized Discovered Hostnames</span>
                                          <span className="font-mono text-[10px]">
                                            {(job.flags as any).subdomains.length} entries
                                          </span>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
                                          {(job.flags as any).subdomains.map(
                                            (sub: string, idx: number) => (
                                              <div
                                                key={idx}
                                                className="px-3 py-1.5 flex items-center justify-between text-xs hover:bg-white/5 font-mono"
                                              >
                                                <span className="text-emerald-400">{sub}</span>
                                                <span className="text-[10px] text-text-muted">
                                                  subfinder
                                                </span>
                                              </div>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    ) : job.status === "running" ? (
                                      <div className="p-8 text-center text-xs text-text-muted">
                                        <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto mb-2" />
                                        Discovery in progress. Discovered hostnames will populate upon completion.
                                      </div>
                                    ) : (
                                      <div className="p-6 rounded-xl border border-border bg-bg-subtle text-center text-xs text-text-muted">
                                        No hostnames were discovered for this domain (0 results found or tool unavailable).
                                      </div>
                                    )}
                                  </div>
                                ) : expandedTab === "logs" ? (
                                  <div className="space-y-4">
                                    {/* If running, show live WebSocket log */}
                                    {job.status === "running" ? (
                                      <div className="space-y-2">
                                        <div className="text-[11px] text-text-muted flex items-center justify-between">
                                          <span>Streaming live console output over runner socket:</span>
                                          <span className="font-mono text-accent">Active Channel</span>
                                        </div>
                                        <LiveLog jobId={job.id} />
                                      </div>
                                    ) : (
                                      /* Captured stdout / stderr */
                                      <div className="space-y-3">
                                        {/* Stdout view */}
                                        <div className="rounded-lg border border-border overflow-hidden">
                                          <div className="px-3 py-1.5 bg-bg-base border-b border-border text-[11px] font-semibold text-text-muted flex items-center justify-between">
                                            <span>Standard Output (stdout)</span>
                                            <span className="font-mono text-[10px]">
                                              {logs?.stdout ? logs.stdout.split("\n").length : 0} lines
                                            </span>
                                          </div>
                                          <pre className="p-3 bg-black text-emerald-400 font-mono text-xs leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                                            {logs?.stdout || "No stdout produced."}
                                          </pre>
                                        </div>

                                        {/* Stderr view if present */}
                                        {(logs?.stderr || job.error_log) && (
                                          <div className="rounded-lg border border-critical/30 overflow-hidden">
                                            <div className="px-3 py-1.5 bg-critical-muted/40 border-b border-critical/20 text-[11px] font-semibold text-critical flex items-center justify-between">
                                              <span>Standard Error (stderr / diagnostics)</span>
                                              <span className="font-mono text-[10px]">Failure Log</span>
                                            </div>
                                            <pre className="p-3 bg-black text-rose-400 font-mono text-xs leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                                              {logs?.stderr || job.error_log}
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : expandedTab === "artifacts" ? (
                                  /* Artifacts View */
                                  <div>
                                    {artifacts?.available && artifacts.files && artifacts.files.length > 0 ? (
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-semibold text-text-primary">
                                            Saved Evidence Files ({artifacts.files.length})
                                          </span>
                                          {artifacts.evidence_path && (
                                            <span className="font-mono text-[11px] text-text-muted">
                                              Path: {artifacts.evidence_path}
                                            </span>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {artifacts.files.map((file, idx) => (
                                            <div
                                              key={idx}
                                              className="p-3 rounded-lg border border-border bg-bg-subtle flex items-center justify-between"
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                <FolderArchive className="w-4 h-4 text-primary flex-shrink-0" />
                                                <span className="font-mono text-xs text-text-primary truncate">
                                                  {file}
                                                </span>
                                              </div>
                                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg-elevated text-text-muted border border-border">
                                                Persisted
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                        <p className="text-[11px] text-text-muted italic mt-2">
                                          Artifacts are stored in the host&apos;s persistent evidence directory and can be analyzed in downstream pipeline stages.
                                        </p>
                                      </div>
                                    ) : (
                                      /* Expired or Unavailable Artifacts */
                                      <div className="p-6 rounded-xl border border-border bg-bg-subtle text-center space-y-2">
                                        <FolderArchive className="w-8 h-8 text-text-muted mx-auto" />
                                        <h4 className="text-xs font-semibold text-text-primary">
                                          No saved evidence artifacts available
                                        </h4>
                                        <p className="text-xs text-text-muted max-w-md mx-auto">
                                          {artifacts?.message ||
                                            "No saved evidence artifacts are available for this job, or they have expired."}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* Execution Metadata */
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                    <div className="space-y-2 p-3 rounded-lg border border-border bg-bg-subtle">
                                      <h5 className="font-semibold text-text-primary">Runner Configuration</h5>
                                      <div className="space-y-1 font-mono text-[11px]">
                                        <div className="flex justify-between py-1 border-b border-border/50">
                                          <span className="text-text-muted">Job ID:</span>
                                          <span className="text-text-primary">{job.id}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-border/50">
                                          <span className="text-text-muted">Target:</span>
                                          <span className="text-text-primary">{targetDisplay}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-border/50">
                                          <span className="text-text-muted">Tool:</span>
                                          <span className="text-text-primary">{toolName}</span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                          <span className="text-text-muted">Pipeline Stage:</span>
                                          <span className="text-text-primary">{stageName}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-2 p-3 rounded-lg border border-border bg-bg-subtle">
                                      <h5 className="font-semibold text-text-primary">Execution Timestamps</h5>
                                      <div className="space-y-1 font-mono text-[11px]">
                                        <div className="flex justify-between py-1 border-b border-border/50">
                                          <span className="text-text-muted">Created:</span>
                                          <span className="text-text-primary">
                                            {createdTime ? new Date(createdTime).toLocaleString() : "—"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-border/50">
                                          <span className="text-text-muted">Started:</span>
                                          <span className="text-text-primary">
                                            {startedTime ? new Date(startedTime).toLocaleString() : "—"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-border/50">
                                          <span className="text-text-muted">Finished:</span>
                                          <span className="text-text-primary">
                                            {completedTime ? new Date(completedTime).toLocaleString() : "—"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                          <span className="text-text-muted">Duration:</span>
                                          <span className="text-text-primary">{durationText}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </div>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dispatch New Scan Modal */}
      {newScanOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-primary fill-current" />
                <h3 className="text-base font-semibold text-text-primary">Dispatch New Scan Job</h3>
              </div>
              <button
                onClick={() => {
                  if (!isSubmitting) setNewScanOpen(false)
                }}
                disabled={isSubmitting}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLaunchScan} className="p-6 space-y-4">
              {/* Actionable Error Banner inside Modal */}
              {modalError && (
                <div className="p-3 rounded-xl border border-critical/30 bg-critical-muted text-xs text-critical flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Creation Rejected:</span> {modalError}
                  </div>
                </div>
              )}

              {/* Target Program Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Target Program</Label>
                <select
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.active_approved ? "✓ (Active Approved)" : "⚠ (Passive Only)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope & Target Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-text-secondary">Authorized Target / Scope</Label>
                  <span className="text-[10px] text-text-muted">
                    {selectedScopeList.filter((s) => !s.out_of_scope).length} rules defined
                  </span>
                </div>

                {selectedScopeList.length > 0 && (
                  <select
                    value={selectedTarget}
                    onChange={(e) => {
                      setSelectedTarget(e.target.value)
                      setCustomTarget("")
                    }}
                    disabled={isSubmitting}
                    className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-xs text-text-primary mb-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Choose from Program Scope --</option>
                    {selectedScopeList.map((s) => {
                      const val = s.targetValue || s.target || ""
                      const isOos = s.out_of_scope || s.inScope === false
                      return (
                        <option key={s.id} value={val} disabled={isOos}>
                          {val} ({s.target_type || s.targetType || "domain"}{isOos ? " — OUT OF SCOPE" : " — IN SCOPE"})
                        </option>
                      )
                    })}
                  </select>
                )}

                <Input
                  type="text"
                  placeholder="Or enter specific host/target (e.g. *.uber.com, api.uber.com)"
                  value={customTarget}
                  onChange={(e) => setCustomTarget(e.target.value)}
                  disabled={isSubmitting}
                  className="bg-bg-subtle border-border text-xs font-mono"
                />
              </div>

              {/* Tool Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Security Tool Engine</Label>
                <select
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {allowedTools.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — Stage {t.stage} ({t.desc})
                    </option>
                  ))}
                </select>
              </div>

              {/* Display Selected Target and Scope Verification Before Submission */}
              <div className="p-3 rounded-xl border border-border bg-bg-subtle space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-text-primary font-medium">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  <span>Pre-flight Scope & Authorization Summary</span>
                </div>
                <div className="font-mono text-[11px] space-y-1 text-text-secondary">
                  <div>
                    Target: <span className="text-text-primary font-bold">{effectiveTarget || "None specified"}</span>
                  </div>
                  <div>
                    Program:{" "}
                    <span className="text-text-primary">
                      {selectedProg?.name || "Selected Program"}
                    </span>
                  </div>
                  <div>
                    Active Scan Approved:{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        selectedProg?.active_approved ? "text-low" : "text-medium"
                      )}
                    >
                      {selectedProg?.active_approved ? "YES" : "NO (Passive reconnaissance only)"}
                    </span>
                  </div>
                </div>

                {/* Precondition warning if active scan selected but program not approved */}
                {isSelectedActiveTool && !selectedProg?.active_approved && (
                  <div className="mt-2 p-2 rounded-lg bg-medium-muted/60 border border-medium/30 text-[11px] text-medium flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Approval Required:</strong> Tool <code>{selectedTool}</code> is an active scanning tool (Stage {selectedToolObj?.stage}). The backend requires explicit active scan approval and will reject unauthorized requests with 428 Precondition Required.
                    </div>
                  </div>
                )}
              </div>

              {/* Concurrency limit notice */}
              <div className="text-[11px] text-text-muted flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-text-muted flex-shrink-0" />
                <span>
                  Concurrency Safety: Worker pool enforces <code>MAX_CONCURRENT_JOBS = 2</code>. Jobs exceeding limit will queue automatically.
                </span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewScanOpen(false)}
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !effectiveTarget}
                  className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-glow-primary"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Dispatching...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" /> Dispatch Job
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

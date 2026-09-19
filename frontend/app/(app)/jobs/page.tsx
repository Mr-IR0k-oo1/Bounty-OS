"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Play, Square, Activity, Clock, CheckCircle2, XCircle, 
  ChevronDown, Filter, Terminal, X, RefreshCw, Layers
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { LiveLog } from "@/components/recon/LiveLog"

interface Job {
  id: string
  program: string
  stage: string
  tool: string
  status: "running" | "queued" | "done" | "failed" | "cancelled"
  started: string
  duration: string
  findings: number
}

const initialJobs: Job[] = [
  { id: "job-101", program: "Uber — HackerOne", stage: "Stage 2 — Host Validation", tool: "httpx", status: "running", started: "2m ago", duration: "1m 45s", findings: 0 },
  { id: "job-102", program: "Grab — Bugcrowd", stage: "Stage 1 — Passive Recon", tool: "subfinder", status: "running", started: "4m ago", duration: "4m 12s", findings: 0 },
  { id: "job-103", program: "Shopify — Intigriti", stage: "Stage 5 — Vulnerabilities", tool: "nuclei", status: "queued", started: "—", duration: "—", findings: 0 },
  { id: "job-104", program: "Twitter — H1", stage: "Stage 4 — Crawl & Content", tool: "katana", status: "done", started: "1h ago", duration: "8m 30s", findings: 5 },
  { id: "job-105", program: "Acme Corp", stage: "Full Pipeline", tool: "all", status: "failed", started: "2h ago", duration: "3m 12s", findings: 0 },
  { id: "job-106", program: "Uber — HackerOne", stage: "Stage 1 — Passive Recon", tool: "subfinder", status: "done", started: "3h ago", duration: "5m 0s", findings: 0 },
  { id: "job-107", program: "Grab — Bugcrowd", stage: "Stage 3 — Port Discovery", tool: "naabu", status: "cancelled", started: "5h ago", duration: "2m 10s", findings: 0 },
]

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  running: { icon: Activity, color: "text-accent", bg: "bg-accent-muted" },
  queued: { icon: Clock, color: "text-text-muted", bg: "bg-bg-subtle" },
  done: { icon: CheckCircle2, color: "text-low", bg: "bg-low-muted" },
  failed: { icon: XCircle, color: "text-critical", bg: "bg-critical-muted" },
  cancelled: { icon: XCircle, color: "text-text-subtle", bg: "bg-bg-subtle" },
}

export default function JobsPage() {
  const { toast } = useToast()
  const [jobsList, setJobsList] = useState<Job[]>(initialJobs)
  const [filter, setFilter] = useState("All")
  const [expandedJob, setExpandedJob] = useState<string | null>("job-101")
  const [newScanOpen, setNewScanOpen] = useState(false)

  // New scan form
  const [scanProgram, setScanProgram] = useState("Uber — HackerOne")
  const [scanStage, setScanStage] = useState("Stage 1 — Passive Recon")
  const [scanTool, setScanTool] = useState("subfinder")
  const [scanConcurrency, setScanConcurrency] = useState("25")

  const filters = ["All", "Running", "Queued", "Done", "Failed"]

  const runningCount = jobsList.filter((j) => j.status === "running").length
  const queuedCount = jobsList.filter((j) => j.status === "queued").length

  const filtered = filter === "All" 
    ? jobsList 
    : jobsList.filter((j) => j.status === filter.toLowerCase())

  const handleStopJob = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setJobsList((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "cancelled", duration: "Stopped" } : j))
    )
    toast({ title: "Job Cancelled", description: `Scan job ${jobId} was stopped.` })
  }

  const handleLaunchScan = (e: React.FormEvent) => {
    e.preventDefault()
    const newJob: Job = {
      id: `job-${Date.now().toString().slice(-4)}`,
      program: scanProgram,
      stage: scanStage,
      tool: scanTool,
      status: "running",
      started: "Just now",
      duration: "0m 05s",
      findings: 0,
    }

    setJobsList((prev) => [newJob, ...prev])
    setExpandedJob(newJob.id)
    setNewScanOpen(false)
    toast({ title: "Scan Dispatched", description: `Started ${scanStage} for ${scanProgram}.` })
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2.5">
            Orchestrated Scan Jobs
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
          <p className="text-xs text-text-muted mt-1">Live background jobs, stage automation, and worker logs.</p>
        </div>

        <Button
          onClick={() => setNewScanOpen(true)}
          className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-glow-primary self-start sm:self-auto"
          size="sm"
        >
          <Play className="w-3.5 h-3.5 fill-current" /> Dispatch New Scan
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-bg-elevated border border-border w-fit">
        {filters.map((f) => {
          const count = f === "All" 
            ? jobsList.length 
            : jobsList.filter((j) => j.status === f.toLowerCase()).length
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5",
                filter === f
                  ? "bg-primary text-white shadow-glow-primary"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-overlay"
              )}
            >
              <span>{f}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full",
                filter === f ? "bg-white/20 text-white" : "bg-bg-subtle text-text-muted"
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Jobs Table */}
      <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header border-b border-border bg-bg-subtle/50 text-[10px] font-bold text-text-muted uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Program</th>
              <th className="px-4 py-3 text-left">Pipeline Stage</th>
              <th className="px-4 py-3 text-left">Tool</th>
              <th className="px-4 py-3 text-left">Started</th>
              <th className="px-4 py-3 text-left">Duration</th>
              <th className="px-4 py-3 text-left">Findings</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filtered.map((job) => {
              const config = statusConfig[job.status]
              const Icon = config.icon
              const expanded = expandedJob === job.id

              return (
                <div key={job.id} className="contents">
                  <tr
                    onClick={() => setExpandedJob(expanded ? null : job.id)}
                    className={cn(
                      "table-row cursor-pointer transition-colors",
                      expanded ? "bg-bg-overlay/60" : "hover:bg-bg-overlay/40"
                    )}
                  >
                    <td className="px-4 py-3.5">
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
                          {job.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-text-primary">
                      {job.program}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text-secondary">
                      {job.stage}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="badge bg-bg-subtle text-text-muted font-mono text-[10px]">
                        {job.tool}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-text-muted whitespace-nowrap">{job.started}</td>
                    <td className="px-4 py-3.5 text-xs text-text-muted font-mono">{job.duration}</td>
                    <td className="px-4 py-3.5">
                      {job.findings > 0 ? (
                        <span className="badge bg-critical-muted text-critical font-bold text-xs">
                          {job.findings} findings
                        </span>
                      ) : (
                        <span className="text-xs text-text-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedJob(expanded ? null : job.id)
                          }}
                          className={cn(
                            "p-1.5 rounded-lg border border-border text-xs transition-colors",
                            expanded ? "bg-primary text-white border-primary" : "bg-bg-subtle text-text-muted hover:text-text-primary"
                          )}
                          title="Toggle Live Console"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                        {(job.status === "running" || job.status === "queued") && (
                          <button
                            onClick={(e) => handleStopJob(job.id, e)}
                            className="p-1.5 rounded-lg border border-critical/30 bg-critical-muted text-critical hover:bg-critical/20 transition-colors"
                            title="Stop Scan Job"
                          >
                            <Square className="w-3.5 h-3.5 fill-current" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {expanded && (
                    <tr className="bg-bg-base/60">
                      <td colSpan={8} className="p-4">
                        <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden shadow-inner">
                          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-subtle/80">
                            <div className="flex items-center gap-2">
                              <Terminal className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-semibold text-text-primary">
                                Live stdout/stderr Stream — {job.program} ({job.tool})
                              </span>
                            </div>
                            <span className="badge bg-primary-muted text-primary text-[10px] font-mono">
                              PID: 28419
                            </span>
                          </div>
                          <div className="p-3">
                            <LiveLog jobId={job.id} />
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

      {/* New Scan Modal */}
      {newScanOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-primary fill-current" />
                <h3 className="text-base font-semibold text-text-primary">Dispatch New Scan Job</h3>
              </div>
              <button
                onClick={() => setNewScanOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-overlay"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleLaunchScan} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Target Program</Label>
                <select
                  value={scanProgram}
                  onChange={(e) => setScanProgram(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-xs text-text-primary"
                >
                  <option value="Uber — HackerOne">Uber — HackerOne (*.uber.com)</option>
                  <option value="Grab — Bugcrowd">Grab — Bugcrowd (*.grab.com)</option>
                  <option value="Shopify — Intigriti">Shopify — Intigriti (*.shopify.com)</option>
                  <option value="Twitter — H1">Twitter — H1 (*.twitter.com)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-text-secondary">Pipeline Stage</Label>
                  <select
                    value={scanStage}
                    onChange={(e) => setScanStage(e.target.value)}
                    className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-xs text-text-primary"
                  >
                    <option value="Stage 1 — Passive Recon">Stage 1 — Passive Recon</option>
                    <option value="Stage 2 — Host Validation">Stage 2 — Host Validation</option>
                    <option value="Stage 3 — Port Discovery">Stage 3 — Port Discovery</option>
                    <option value="Stage 4 — Crawl & Content">Stage 4 — Content Discovery</option>
                    <option value="Stage 5 — Vulnerabilities">Stage 5 — Vulnerability Scan</option>
                    <option value="Full Pipeline Scan">Full Pipeline (Automated)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-text-secondary">Engine / Tool</Label>
                  <select
                    value={scanTool}
                    onChange={(e) => setScanTool(e.target.value)}
                    className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-xs text-text-primary"
                  >
                    <option value="subfinder">subfinder + amass</option>
                    <option value="httpx">httpx + dnsx</option>
                    <option value="naabu">naabu + nmap</option>
                    <option value="katana">katana + gau</option>
                    <option value="nuclei">nuclei (cves, misconfigs)</option>
                    <option value="all">orchestrator (all)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Concurrency Limit (Threads)</Label>
                <Input
                  type="number"
                  value={scanConcurrency}
                  onChange={(e) => setScanConcurrency(e.target.value)}
                  className="bg-bg-subtle border-border text-xs"
                  min="1"
                  max="100"
                />
              </div>

              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-text-secondary">
                Scan job will be placed in the worker queue and executed inside the sandboxed Docker runner. Output logs stream in real-time.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewScanOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Start Job
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


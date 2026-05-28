"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Square, Activity, Clock, CheckCircle2, XCircle, ChevronDown, Filter, Terminal } from "lucide-react"
import { cn } from "@/lib/utils"

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

const jobs: Job[] = [
  { id: "1", program: "Uber — HackerOne", stage: "Stage 2 — Validation", tool: "httpx", status: "running", started: "2m ago", duration: "1m 45s", findings: 0 },
  { id: "2", program: "Grab — Bugcrowd", stage: "Stage 1 — Passive", tool: "subfinder", status: "running", started: "4m ago", duration: "4m 12s", findings: 0 },
  { id: "3", program: "Shopify — Intigriti", stage: "Stage 4 — Vuln", tool: "nuclei", status: "queued", started: "—", duration: "—", findings: 0 },
  { id: "4", program: "Twitter — H1", stage: "Stage 3 — Active", tool: "ffuf", status: "done", started: "1h ago", duration: "8m 30s", findings: 5 },
  { id: "5", program: "Acme Corp", stage: "Full Pipeline", tool: "all", status: "failed", started: "2h ago", duration: "3m 12s", findings: 0 },
  { id: "6", program: "Uber — HackerOne", stage: "Stage 1 — Passive", tool: "subfinder", status: "done", started: "3h ago", duration: "5m 0s", findings: 0 },
  { id: "7", program: "Grab — Bugcrowd", stage: "Stage 4 — Vuln", tool: "nuclei", status: "cancelled", started: "5h ago", duration: "2m 10s", findings: 0 },
]

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  running: { icon: Activity, color: "text-accent", bg: "bg-accent-muted" },
  queued: { icon: Clock, color: "text-text-muted", bg: "bg-bg-subtle" },
  done: { icon: CheckCircle2, color: "text-low", bg: "bg-low-muted" },
  failed: { icon: XCircle, color: "text-critical", bg: "bg-critical-muted" },
  cancelled: { icon: XCircle, color: "text-text-subtle", bg: "bg-bg-subtle" },
}

export default function JobsPage() {
  const [filter, setFilter] = useState("All")
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const filters = ["All", "Running", "Queued", "Done", "Failed"]
  const logLines = [
    "[14:23:01] [INFO] Starting httpx scan on 384 targets",
    "[14:23:05] [INFO] Processing batch 1/10",
    "[14:23:12] [INFO] Host 52.84.122.34:443 — 200 OK",
    "[14:23:15] [INFO] Host 34.204.87.12:443 — 301 Redirect",
    "[14:23:18] [WARN] Timeout on 10.0.0.1:80",
    "[14:23:22] [INFO] Processing batch 2/10",
    "[14:23:28] [INFO] Host 18.205.56.89:443 — 200 OK",
    "[14:23:30] [INFO] Processing batch 3/10",
    "[14:23:35] [INFO] Scan complete — 127 live hosts found",
  ]

  const filtered = filter === "All" ? jobs : jobs.filter(j => j.status === filter.toLowerCase())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            Scan Jobs
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-muted text-accent">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              2 Running
            </span>
          </h1>
          <p className="text-sm text-text-muted mt-0.5">Monitor and manage scan pipeline execution</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary rounded-lg text-white text-xs font-medium hover:bg-primary-hover transition-fast">
          <Play className="w-3.5 h-3.5" /> New Scan
        </button>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-base border border-border w-fit">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
              filter === f ? "bg-bg-elevated text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
            )}
          >
            {f}
            {f === "Running" && <span className="ml-1.5 text-[10px] text-accent">2</span>}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Program</th>
              <th className="px-4 py-3 text-left font-medium">Stage</th>
              <th className="px-4 py-3 text-left font-medium">Tool</th>
              <th className="px-4 py-3 text-left font-medium">Started</th>
              <th className="px-4 py-3 text-left font-medium">Duration</th>
              <th className="px-4 py-3 text-left font-medium">Findings</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((job) => {
              const config = statusConfig[job.status]
              const Icon = config.icon
              const expanded = expandedJob === job.id
              return (
                <>
                  <tr
                    key={job.id}
                    onClick={() => setExpandedJob(expanded ? null : job.id)}
                    className={cn("table-row cursor-pointer", expanded && "bg-bg-overlay")}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {job.status === "running" ? (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
                          </span>
                        ) : (
                          <Icon className={cn("w-4 h-4", config.color)} />
                        )}
                        <span className={cn("text-xs capitalize", config.color)}>{job.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary">{job.program}</td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{job.stage}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-bg-subtle text-text-muted">{job.tool}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">{job.started}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{job.duration}</td>
                    <td className="px-4 py-3">
                      {job.findings > 0 ? (
                        <span className="text-xs font-medium text-critical">{job.findings}</span>
                      ) : (
                        <span className="text-xs text-text-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1 rounded hover:bg-bg-overlay text-text-subtle hover:text-text-primary transition-fast">
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                        {(job.status === "running" || job.status === "queued") && (
                          <button className="p-1 rounded hover:bg-critical-muted text-text-subtle hover:text-critical transition-fast">
                            <Square className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={8} className="px-4 pb-3">
                        <div className="rounded-lg bg-bg-base border border-border p-3 font-mono text-xs leading-relaxed max-h-48 overflow-y-auto">
                          {logLines.map((line, i) => {
                            const isInfo = line.includes("[INFO]")
                            const isWarn = line.includes("[WARN]")
                            const isError = line.includes("[ERROR]")
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "py-0.5",
                                  isWarn && "text-high",
                                  isError && "text-critical",
                                  isInfo && "text-text-secondary"
                                )}
                              >
                                {line}
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

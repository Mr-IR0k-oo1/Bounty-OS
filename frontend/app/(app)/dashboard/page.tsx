"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  FolderKanban, Target, Bug, Users, Clock,
  Activity, Play, ArrowUpRight, ArrowDownRight, ChevronRight, RadioTower,
  RefreshCw, CheckCircle2, AlertCircle
} from "lucide-react"
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, CartesianGrid
} from "recharts"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/useToast"
import type { Project, Program, Finding, ScanJob } from "@/lib/types"

const severityColor = {
  critical: "#f85149",
  high: "#e8912d",
  medium: "#58a6ff",
  low: "#3fb950",
  info: "#8b949e",
} as const

type SeverityKey = keyof typeof severityColor

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-bg-overlay/95 backdrop-blur px-3 py-2 shadow-lg text-xs">
      <div className="font-mono text-text-primary text-[11px] mb-1">{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 tabular">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.stroke }} />
          <span className="text-text-muted capitalize">{entry.dataKey}</span>
          <span className="ml-auto pl-4 text-text-primary font-mono">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

function PieTip({ active, payload, total }: { active?: boolean; payload?: any; total: number }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0
  return (
    <div className="rounded-lg border border-border bg-bg-overlay/95 backdrop-blur px-3 py-2 shadow-lg text-xs flex items-center gap-2">
      <span className="w-2 h-2 rounded-full" style={{ background: item.payload.color }} />
      <span className="text-text-muted">{item.name}</span>
      <span className="text-text-primary font-mono tabular">{item.value} ({pct}%)</span>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [activePie, setActivePie] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [projects, setProjects] = useState<Project[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [jobs, setJobs] = useState<ScanJob[]>([])

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const [projData, progData, findData, jobData] = await Promise.all([
        api.listProjects().catch(() => []),
        api.listPrograms().catch(() => []),
        api.listFindings().catch(() => []),
        api.listJobs().catch(() => []),
      ])
      setProjects(projData || [])
      setPrograms(progData || [])
      setFindings(findData || [])
      setJobs(jobData || [])
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to load dashboard data",
        description: e.message || "Could not connect to backend server",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Computed metrics
  const activeProjects = projects.filter((p) => p.active !== false)
  const activePrograms = programs.filter((p) => p.active !== false)

  const counts: Record<SeverityKey, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  }

  for (const f of findings) {
    const sev = (f.severity || "info").toLowerCase() as SeverityKey
    if (counts[sev] !== undefined) {
      counts[sev]++
    }
  }

  const totalOpen = findings.filter((f) => f.status !== "fp" && f.status !== "na").length || findings.length

  const heroStats: { severity: SeverityKey; value: number }[] = [
    { severity: "critical", value: counts.critical },
    { severity: "high", value: counts.high },
    { severity: "medium", value: counts.medium },
    { severity: "low", value: counts.low },
    { severity: "info", value: counts.info },
  ]

  const submittedCount = findings.filter((f) => f.status === "submitted" || f.status === "bounty_awarded").length
  const newLast24h = findings.filter((f) => {
    if (!f.foundAt && !(f as any).created_at) return false
    const d = new Date(f.foundAt || (f as any).created_at).getTime()
    return Date.now() - d < 86400000
  }).length

  const compactStats = [
    { label: "Active Projects", value: String(activeProjects.length || projects.length), change: "Active", trend: "up" as const, icon: FolderKanban },
    { label: "Programs Enrolled", value: String(programs.length), change: `${programs.filter(p => p.activeApproved).length} approved`, trend: "up" as const, icon: Target },
    { label: "New Findings (24h)", value: String(newLast24h), change: `${findings.length} total`, trend: newLast24h > 0 ? "up" as const : "down" as const, icon: Bug },
    { label: "Submitted Findings", value: String(submittedCount), change: "Triage pipeline", trend: "up" as const, icon: Clock },
  ]

  // Time trend: group findings by day-of-week for last 7 days
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const now = new Date()
  const areaData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    const dayStr = dayNames[d.getDay()]
    const ymd = d.toISOString().slice(0, 10)

    const dayFindings = findings.filter((f) => {
      const dt = f.foundAt || (f as any).created_at
      return dt && dt.slice(0, 10) === ymd
    })

    return {
      day: dayStr,
      critical: dayFindings.filter((f) => (f.severity || "").toLowerCase() === "critical").length,
      high: dayFindings.filter((f) => (f.severity || "").toLowerCase() === "high").length,
      medium: dayFindings.filter((f) => (f.severity || "").toLowerCase() === "medium").length,
      low: dayFindings.filter((f) => (f.severity || "").toLowerCase() === "low").length,
    }
  })

  const areaSeries: { key: SeverityKey; label: string }[] = [
    { key: "critical", label: "Critical" },
    { key: "high", label: "High" },
    { key: "medium", label: "Medium" },
    { key: "low", label: "Low" },
  ]

  const pieData = [
    { name: "Critical", value: counts.critical, color: severityColor.critical },
    { name: "High", value: counts.high, color: severityColor.high },
    { name: "Medium", value: counts.medium, color: severityColor.medium },
    { name: "Low", value: counts.low, color: severityColor.low },
    { name: "Info", value: counts.info, color: severityColor.info },
  ].filter((p) => p.value > 0 || totalOpen === 0)

  // Active / running scans
  const activeJobs = jobs.filter((j) => j.status === "running" || j.status === "queued")

  // Recent activity from findings & jobs
  const recentActivity = [
    ...findings.slice(0, 4).map((f) => ({
      type: (f.severity || "info").toLowerCase() as SeverityKey,
      message: f.title,
      tool: f.tool || "recon",
      time: f.foundAt ? new Date(f.foundAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently",
      program: programs.find((p) => p.id === (f.programId || (f as any).program_id))?.name || "Target",
    })),
    ...jobs.slice(0, 3).map((j) => ({
      type: (j.status === "succeeded" || j.status === "done" ? "low" : j.status === "failed" ? "critical" : "medium") as SeverityKey,
      message: `Job ${j.tool} ${j.status}`,
      tool: j.tool,
      time: j.startedAt ? new Date(j.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently",
      program: programs.find((p) => p.id === j.programId)?.name || "Target",
    })),
  ]

  const handleQuickScan = async () => {
    const targetProgram = programs.find((p) => p.active !== false) || programs[0]
    if (!targetProgram) {
      toast({
        variant: "destructive",
        title: "No Target Programs",
        description: "Please create a program first to run automated scans.",
      })
      router.push("/programs")
      return
    }

    try {
      await api.scanProgram(targetProgram.id)
      toast({
        title: "Scan Dispatched",
        description: `Automated scan initiated for ${targetProgram.name}.`,
      })
      loadData(true)
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Scan Trigger Failed",
        description: e.message || "Failed to trigger scan",
      })
    }
  }

  const handleCancelJob = async (jobId: string) => {
    try {
      await api.cancelJob(jobId)
      toast({ title: "Job Cancelled", description: `Job ${jobId} stopped.` })
      loadData(true)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Cancel Failed", description: e.message })
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-text-subtle">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
            </span>
            Workspace / Operations Overview
          </div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight mt-1">Operations Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Live posture across {programs.length} target program(s) and {activeProjects.length} engagement(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-bg-elevated hover:bg-bg-overlay text-text-primary text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-primary" : "text-text-muted"}`} />
            Refresh
          </button>
          <button
            onClick={handleQuickScan}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary rounded-lg text-white text-xs font-semibold hover:bg-primary-hover transition-fast shadow-glow-primary btn-primary"
          >
            <Play className="w-3.5 h-3.5" /> Quick Scan
          </button>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Hero metric */}
        <div className="col-span-12 xl:col-span-5 finding-stat-card relative overflow-hidden">
          <div className="absolute inset-0 tech-grid opacity-40 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-text-muted flex items-center gap-1.5">
                <RadioTower className="w-3.5 h-3.5 text-accent" />
                Total Findings
              </span>
              <span className="flex items-center gap-1 text-[11px] text-accent font-medium font-mono">
                Live Data
              </span>
            </div>
            <div className="mt-3 flex items-end gap-2.5">
              <span className="text-5xl font-black font-mono tracking-tighter text-text-primary tabular leading-none">
                {findings.length}
              </span>
              <span className="text-xs text-text-muted pb-1">across {programs.length} program(s)</span>
            </div>

            {/* Stacked severity bar */}
            <div className="mt-5 space-y-1.5">
              {heroStats.map((s) => (
                <div key={s.severity} className="flex items-center gap-3 tabular">
                  <span className="w-16 text-[10px] font-mono uppercase tracking-wider text-text-muted">{s.severity}</span>
                  <div className="flex-1 progress-bar h-1.5 bg-bg-subtle">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${totalOpen > 0 ? (s.value / totalOpen) * 100 : 0}%`,
                        background: severityColor[s.severity],
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-[11px] font-mono text-text-secondary">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Compact cards */}
        <div className="col-span-12 xl:col-span-7 grid grid-cols-2 gap-4">
          {compactStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="finding-stat-card flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="w-8 h-8 rounded-lg bg-primary-muted flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="flex items-center gap-0.5 text-[11px] text-text-muted font-mono tabular">
                    {stat.change}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-bold text-text-primary font-mono tabular leading-none">{stat.value}</div>
                  <div className="text-xs text-text-muted mt-1.5">{stat.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-8 finding-stat-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-mono font-semibold text-text-muted uppercase tracking-[0.14em]">Findings Over Time (Last 7 Days)</h2>
            <div className="hidden sm:flex items-center gap-3">
              {areaSeries.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-text-muted tabular">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: severityColor[s.key] }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ left: -18, right: 6, top: 4 }}>
                <defs>
                  {areaSeries.map((s) => (
                    <linearGradient key={s.key} id={`${s.key}Grad`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={severityColor[s.key]} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={severityColor[s.key]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <Tooltip content={<ChartTip />} />
                {areaSeries.map((s) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stackId="1"
                    stroke={severityColor[s.key]}
                    strokeWidth={1.5}
                    fill={`url(#${s.key}Grad)`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-12 xl:col-span-4 finding-stat-card">
          <h2 className="text-[11px] font-mono font-semibold text-text-muted uppercase tracking-[0.14em] mb-2">
            Severity Breakdown
          </h2>
          <div className="h-[190px] flex items-center justify-center">
            <div className="relative">
              <ResponsiveContainer width={200} height={180}>
                <PieChart>
                  <Pie
                    data={pieData.length > 0 ? pieData : [{ name: "None", value: 1, color: "#30363d" }]}
                    cx={100}
                    cy={90}
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    onMouseEnter={(_: unknown, index: number) => setActivePie(index)}
                    onMouseLeave={() => setActivePie(null)}
                    style={{ outline: "none" }}
                  >
                    {(pieData.length > 0 ? pieData : [{ name: "None", value: 1, color: "#30363d" }]).map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={entry.color}
                        opacity={activePie === null || activePie === index ? 1 : 0.3}
                        style={{ transition: "opacity .18s ease", outline: "none", cursor: "pointer" }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTip total={totalOpen} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none pt-3">
                <div className="text-center">
                  <div className="text-xl font-bold text-text-primary font-mono tabular leading-none">{findings.length}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">Total findings</div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
            {heroStats.map((item) => (
              <div key={item.severity} className="flex items-center gap-2 text-xs tabular">
                <div className="w-2 h-2 rounded-full" style={{ background: severityColor[item.severity] }} />
                <span className="text-text-secondary capitalize">{item.severity}</span>
                <span className="ml-auto text-text-muted font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active scans */}
      <div className="finding-stat-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-mono font-semibold text-text-muted uppercase tracking-[0.14em]">
            <span className="inline-flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
              </span>
              Active Scans & Queued Jobs
            </span>
          </h2>
          <Link href="/jobs" className="text-xs text-primary hover:underline font-mono">view all jobs →</Link>
        </div>
        <div className="divide-y divide-border-subtle rounded-lg border border-border bg-bg-base/40">
          {activeJobs.map((job) => {
            const prog = programs.find((p) => p.id === job.programId)
            return (
              <div key={job.id} className="flex items-center gap-4 p-3.5 hover:bg-bg-overlay/60 transition-fast group">
                <div className="w-8 h-8 rounded-lg bg-bg-subtle flex items-center justify-center shrink-0 group-hover:bg-accent-muted transition-colors">
                  <Activity className="w-4 h-4 text-accent animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-text-primary truncate">
                      {prog ? prog.name : `Program ${job.programId}`}
                    </span>
                    <span className="text-xs font-mono text-text-secondary shrink-0 tabular">
                      {job.startedAt ? new Date(job.startedAt).toLocaleTimeString() : "Queued"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-accent bg-accent-muted border border-accent/20 rounded px-1.5 py-0.5 uppercase tracking-wider">
                      Stage {job.stage || 1}
                    </span>
                    <span className="text-[10px] font-mono text-text-muted bg-bg-subtle px-1.5 py-0.5 rounded">
                      {job.tool}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelJob(job.id)}
                  className="text-xs text-text-subtle hover:text-critical transition-fast shrink-0 px-2 py-1 rounded hover:bg-critical-muted font-mono"
                >
                  cancel
                </button>
              </div>
            )
          })}
          {activeJobs.length === 0 && (
            <div className="text-sm text-text-muted text-center py-6">No active background scans running</div>
          )}
        </div>
      </div>

      {/* Activity + quick actions */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-8 finding-stat-card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] font-mono font-semibold text-text-muted uppercase tracking-[0.14em]">Recent Activity</h2>
            <Link href="/findings" className="text-xs text-primary hover:underline font-mono">view all findings →</Link>
          </div>
          <div className="space-y-0.5">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-bg-overlay/60 transition-fast group">
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ background: severityColor[item.type] || severityColor.info }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary truncate">{item.message}</span>
                    {item.tool && (
                      <span className="text-[10px] font-mono text-text-muted bg-bg-subtle px-1.5 py-0.5 rounded shrink-0">{item.tool}</span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">{item.program}</div>
                </div>
                <span className="text-xs font-mono text-text-subtle shrink-0 tabular group-hover:text-text-muted transition-colors">{item.time}</span>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="text-sm text-text-muted text-center py-6">No recent findings or scan activities yet</div>
            )}
          </div>
        </div>

        <div className="col-span-12 xl:col-span-4 space-y-4">
          <Link href="/projects" className="block">
            <div className="finding-stat-card hover:border-primary transition-fast cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-muted flex items-center justify-center group-hover:shadow-glow-primary transition-shadow">
                  <FolderKanban className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-text-primary">Projects ({projects.length})</div>
                  <div className="text-xs text-text-muted mt-0.5">Manage bug bounty engagements</div>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted ml-auto group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
          <Link href="/programs" className="block">
            <div className="finding-stat-card hover:border-accent transition-fast cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
                  <Target className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-text-primary">Target Programs ({programs.length})</div>
                  <div className="text-xs text-text-muted mt-0.5">Enrolled scope targets</div>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted ml-auto group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
          <Link href="/findings" className="block">
            <div className="finding-stat-card hover:border-medium transition-fast cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-medium-muted flex items-center justify-center">
                  <Bug className="w-5 h-5 text-medium" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-text-primary">Triage & Validation</div>
                  <div className="text-xs text-text-muted mt-0.5">
                    <span className="text-critical font-mono tabular">{findings.filter(f => f.status === 'new').length}</span> unassigned findings
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted ml-auto group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
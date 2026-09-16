"use client"

import { useState } from "react"
import {
  FolderKanban, Target, Bug, Users, Clock,
  Activity, Play, ArrowUpRight, ArrowDownRight, ChevronRight, RadioTower,
} from "lucide-react"
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, CartesianGrid
} from "recharts"

// --- palette (mirrors design tokens) ---
const severityColor = {
  critical: "#f85149",
  high: "#e8912d",
  medium: "#58a6ff",
  low: "#3fb950",
  info: "#8b949e",
} as const

type SeverityKey = keyof typeof severityColor

const heroStats = [
  { severity: "critical" as SeverityKey, value: 8 },
  { severity: "high" as SeverityKey, value: 24 },
  { severity: "medium" as SeverityKey, value: 36 },
  { severity: "low" as SeverityKey, value: 18 },
  { severity: "info" as SeverityKey, value: 14 },
]

const compactStats = [
  { label: "Active Projects", value: "12", change: "+2", trend: "up" as const, icon: FolderKanban },
  { label: "Programs", value: "48", change: "+5", trend: "up" as const, icon: Target },
  { label: "New Findings (24h)", value: "3", change: "-1", trend: "down" as const, icon: Bug },
  { label: "Submitted This Week", value: "7", change: "+3", trend: "up" as const, icon: Clock },
]

const areaData = [
  { day: "Mon", critical: 2, high: 4, medium: 6, low: 3 },
  { day: "Tue", critical: 1, high: 3, medium: 8, low: 5 },
  { day: "Wed", critical: 3, high: 6, medium: 4, low: 2 },
  { day: "Thu", critical: 0, high: 2, medium: 7, low: 4 },
  { day: "Fri", critical: 2, high: 5, medium: 5, low: 6 },
  { day: "Sat", critical: 1, high: 1, medium: 3, low: 2 },
  { day: "Sun", critical: 2, high: 3, medium: 4, low: 1 },
]

const areaSeries: { key: SeverityKey; label: string }[] = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
]

const pieData = [
  { name: "Critical", value: 8, color: severityColor.critical },
  { name: "High", value: 24, color: severityColor.high },
  { name: "Medium", value: 36, color: severityColor.medium },
  { name: "Low", value: 18, color: severityColor.low },
  { name: "Info", value: 14, color: severityColor.info },
]

const recentActivity = [
  { type: "critical" as const, message: "SSRF in api.uber.com", tool: "nuclei", time: "14:23", program: "Uber — H1" },
  { type: "success" as const, message: "Stage 2 complete — 47 live hosts", tool: "", time: "13:45", program: "Grab — Bugcrowd" },
  { type: "info" as const, message: "New subdomain: secret.uber.com", tool: "", time: "13:12", program: "Uber — H1" },
  { type: "high" as const, message: "SQLi found in checkout.php", tool: "nuclei", time: "11:30", program: "Shopify — Intigriti" },
  { type: "medium" as const, message: "XSS in search endpoint", tool: "nuclei", time: "10:15", program: "Twitter — H1" },
  { type: "success" as const, message: "Finding submitted — SSRF", tool: "", time: "09:45", program: "Uber — H1" },
  { type: "info" as const, message: "Rescan scheduled for Acme Corp", tool: "", time: "08:30", program: "Acme Corp" },
]

const activeJobs = [
  { program: "Uber — HackerOne", stage: "Stage 2 — Validation", tool: "httpx", elapsed: "1m 45s", progress: 65 },
  { program: "Grab — Bugcrowd", stage: "Stage 1 — Passive", tool: "subfinder", elapsed: "4m 12s", progress: 30 },
  { program: "Shopify — Intigriti", stage: "Stage 4 — Vuln", tool: "nuclei", elapsed: "30s", progress: 10 },
]

const activityColor: Record<string, string> = {
  critical: severityColor.critical,
  high: severityColor.high,
  medium: severityColor.medium,
  success: severityColor.low,
  info: severityColor.info,
}

const totalOpen = heroStats.reduce((acc, s) => acc + s.value, 0)

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

function PieTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border border-border bg-bg-overlay/95 backdrop-blur px-3 py-2 shadow-lg text-xs flex items-center gap-2">
      <span className="w-2 h-2 rounded-full" style={{ background: item.payload.color }} />
      <span className="text-text-muted">{item.name}</span>
      <span className="text-text-primary font-mono tabular">{item.value} ({((item.value / totalOpen) * 100).toFixed(0)}%)</span>
    </div>
  )
}

export default function DashboardPage() {
  const [activePie, setActivePie] = useState<number | null>(null)

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
            Workspace / Overview
          </div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight mt-1">Operations Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">Live posture across every program in the workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary rounded-lg text-white text-xs font-medium hover:bg-primary-hover transition-fast shadow-glow-primary btn-primary">
            <Play className="w-3.5 h-3.5" /> Quick Scan
          </button>
        </div>
      </div>

      {/* Stat grid — asymmetric: featured hero + compact cards */}
      <div className="grid grid-cols-12 gap-4">
        {/* Hero metric */}
        <div className="col-span-12 xl:col-span-5 finding-stat-card relative overflow-hidden">
          <div className="absolute inset-0 tech-grid opacity-40 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-text-muted flex items-center gap-1.5">
                <RadioTower className="w-3.5 h-3.5 text-accent" />
                Open findings
              </span>
              <span className="flex items-center gap-1 text-[11px] text-critical font-medium">
                <ArrowUpRight className="w-3 h-3" />+8.2%
              </span>
            </div>
            <div className="mt-3 flex items-end gap-2.5">
              <span className="text-5xl font-black font-mono tracking-tighter text-text-primary tabular leading-none">
                {totalOpen}
              </span>
              <span className="text-xs text-text-muted pb-1">across {compactStats[1].value} programs</span>
            </div>
            {/* Stacked severity bar */}
            <div className="mt-5 space-y-1.5">
              {heroStats.map((s) => (
                <div key={s.severity} className="flex items-center gap-3 tabular">
                  <span className="w-16 text-[10px] font-mono uppercase tracking-wider text-text-muted">{s.severity}</span>
                  <div className="flex-1 progress-bar h-1.5">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${(s.value / totalOpen) * 100}%`, background: severityColor[s.severity] }}
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
                  {stat.trend === "up" ? (
                    <span className="flex items-center gap-0.5 text-[11px] text-low font-medium tabular">
                      <ArrowUpRight className="w-3 h-3" />{stat.change}
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[11px] text-critical font-medium tabular">
                      <ArrowDownRight className="w-3 h-3" />{stat.change}
                    </span>
                  )}
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
            <h2 className="text-[11px] font-mono font-semibold text-text-muted uppercase tracking-[0.14em]">Findings Over Time</h2>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-3">
                {areaSeries.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-text-muted tabular">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: severityColor[s.key] }} />
                    {s.label}
                  </span>
                ))}
              </div>
              <select className="text-[11px] font-mono bg-bg-overlay border border-border rounded px-2 py-1 text-text-muted focus:border-primary transition-colors">
                <option>Last 7 days</option>
                <option>Last 30 days</option>
              </select>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ left: -18, right: 6, top: 4 }}>
                <defs>
                  {areaSeries.map((s) => (
                    <linearGradient key={s.key} id={`${s.key}Grad`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={severityColor[s.key]} stopOpacity={s.key === "info" ? 0.15 : 0.28} />
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
                    data={pieData}
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
                    {pieData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={entry.color}
                        opacity={activePie === null || activePie === index ? 1 : 0.3}
                        style={{ transition: "opacity .18s ease", outline: "none", cursor: "pointer" }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none pt-3">
                <div className="text-center">
                  <div className="text-xl font-bold text-text-primary font-mono tabular leading-none">{totalOpen}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">Total findings</div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs tabular">
                <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                <span className="text-text-secondary">{item.name}</span>
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
              Active Scans
            </span>
          </h2>
          <button className="text-xs text-primary hover:underline font-mono">view all jobs →</button>
        </div>
        <div className="divide-y divide-border-subtle rounded-lg border border-border bg-bg-base/40">
          {activeJobs.map((job) => (
            <div key={job.program} className="flex items-center gap-4 p-3.5 hover:bg-bg-overlay/60 transition-fast group">
              <div className="w-8 h-8 rounded-lg bg-bg-subtle flex items-center justify-center shrink-0 group-hover:bg-accent-muted transition-colors">
                <Activity className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-text-primary truncate">{job.program}</span>
                  <span className="text-xs font-mono text-text-secondary shrink-0 tabular">{job.elapsed}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-accent bg-accent-muted border border-accent/20 rounded px-1.5 py-0.5 uppercase tracking-wider">
                    {job.stage}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted bg-bg-subtle px-1.5 py-0.5 rounded">
                    {job.tool}
                  </span>
                </div>
                <div className="mt-2 progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${job.progress}%` }} />
                </div>
              </div>
              <button className="text-xs text-text-subtle hover:text-critical transition-fast shrink-0 px-2 py-1 rounded hover:bg-critical-muted font-mono">
                cancel
              </button>
            </div>
          ))}
          {activeJobs.length === 0 && (
            <div className="text-sm text-text-muted text-center py-6">No active scans</div>
          )}
        </div>
      </div>

      {/* Activity + quick actions */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-8 finding-stat-card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] font-mono font-semibold text-text-muted uppercase tracking-[0.14em]">Recent Activity</h2>
            <button className="text-xs text-primary hover:underline font-mono">view all →</button>
          </div>
          <div className="space-y-0.5">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-bg-overlay/60 transition-fast group">
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ background: activityColor[item.type] }}
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
          </div>
        </div>

        <div className="col-span-12 xl:col-span-4 space-y-4">
          <div className="finding-stat-card hover:border-primary transition-fast cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-muted flex items-center justify-center group-hover:shadow-glow-primary transition-shadow">
                <FolderKanban className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm text-text-primary">New Project</div>
                <div className="text-xs text-text-muted mt-0.5">Create a new bug bounty project</div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted ml-auto group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
          <div className="finding-stat-card hover:border-accent transition-fast cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
                <Target className="w-5 h-5 text-accent" />
              </div>
              <div>
                <div className="font-semibold text-sm text-text-primary">New Program</div>
                <div className="text-xs text-text-muted mt-0.5">Add a program to an existing project</div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted ml-auto group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
          <div className="finding-stat-card hover:border-medium transition-fast cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-medium-muted flex items-center justify-center">
                <Users className="w-5 h-5 text-medium" />
              </div>
              <div>
                <div className="font-semibold text-sm text-text-primary">Unassigned Triage</div>
                <div className="text-xs text-text-muted mt-0.5">
                  <span className="text-critical font-mono tabular">18</span> findings need triage
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted ml-auto group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
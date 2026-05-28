"use client"

import { useState } from "react"
import {
  FolderKanban, Target, Bug, Users, Clock, TrendingUp,
  Activity, Play, ArrowUpRight, ArrowDownRight, ChevronRight
} from "lucide-react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts"

const statCards = [
  { label: "Active Projects", value: "12", change: "+2", trend: "up", icon: FolderKanban },
  { label: "Programs", value: "48", change: "+5", trend: "up", icon: Target },
  { label: "New Findings (24h)", value: "3", change: "-1", trend: "down", icon: Bug },
  { label: "Unassigned", value: "18", change: "+4", trend: "up", icon: Users },
  { label: "Submitted This Week", value: "7", change: "+3", trend: "up", icon: Clock },
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

const pieData = [
  { name: "Critical", value: 8, color: "#f85149" },
  { name: "High", value: 24, color: "#e8912d" },
  { name: "Medium", value: 36, color: "#58a6ff" },
  { name: "Low", value: 18, color: "#3fb950" },
  { name: "Info", value: 14, color: "#8b949e" },
]

const recentActivity = [
  { type: "critical", message: "SSRF in api.uber.com", tool: "nuclei", time: "14:23", program: "Uber — H1" },
  { type: "success", message: "Stage 2 complete — 47 live hosts", tool: "", time: "13:45", program: "Grab — Bugcrowd" },
  { type: "info", message: "New subdomain: secret.uber.com", tool: "", time: "13:12", program: "Uber — H1" },
  { type: "high", message: "SQLi found in checkout.php", tool: "nuclei", time: "11:30", program: "Shopify — Intigriti" },
  { type: "medium", message: "XSS in search endpoint", tool: "nuclei", time: "10:15", program: "Twitter — H1" },
  { type: "success", message: "Finding submitted — SSRF", tool: "", time: "09:45", program: "Uber — H1" },
  { type: "info", message: "Rescan scheduled for Acme Corp", tool: "", time: "08:30", program: "Acme Corp" },
]

const activeJobs = [
  { program: "Uber — HackerOne", stage: "Stage 2 — Validation", tool: "httpx", elapsed: "1m 45s", progress: 65 },
  { program: "Grab — Bugcrowd", stage: "Stage 1 — Passive", tool: "subfinder", elapsed: "4m 12s", progress: 30 },
  { program: "Shopify — Intigriti", stage: "Stage 4 — Vuln", tool: "nuclei", elapsed: "30s", progress: 10 },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">Overview of all programs and findings</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary rounded-lg text-white text-xs font-medium hover:bg-primary-hover transition-fast shadow-glow-primary">
            <Play className="w-3.5 h-3.5" /> Quick Scan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="finding-stat-card">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary-muted flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                {stat.trend === "up" ? (
                  <span className="flex items-center gap-0.5 text-[11px] text-low font-medium">
                    <ArrowUpRight className="w-3 h-3" />{stat.change}
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-[11px] text-critical font-medium">
                    <ArrowDownRight className="w-3 h-3" />{stat.change}
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-text-primary">{stat.value}</div>
              <div className="text-xs text-text-muted mt-0.5">{stat.label}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 finding-stat-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Findings Over Time</h2>
            <select className="text-[11px] bg-bg-overlay border border-border rounded px-2 py-1 text-text-muted">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
            </select>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData}>
                <defs>
                  <linearGradient id="criticalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f85149" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f85149" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e8912d" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#e8912d" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="mediumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#58a6ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3fb950" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3fb950" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{
                    background: "#1e2335",
                    border: "1px solid #2a2d3e",
                    borderRadius: "8px",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  }}
                  labelStyle={{ color: "#e8edf5" }}
                />
                <Area type="monotone" dataKey="critical" stackId="1" stroke="#f85149" fill="url(#criticalGrad)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="high" stackId="1" stroke="#e8912d" fill="url(#highGrad)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="medium" stackId="1" stroke="#58a6ff" fill="url(#mediumGrad)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="low" stackId="1" stroke="#3fb950" fill="url(#lowGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-4 finding-stat-card">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Severity Breakdown</h2>
          <div className="h-[220px] flex items-center justify-center">
            <div className="relative">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx={100}
                    cy={100}
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1e2335",
                      border: "1px solid #2a2d3e",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-xl font-bold text-text-primary">100</div>
                  <div className="text-[10px] text-text-muted">Total</div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                <span className="text-text-secondary">{item.name}</span>
                <span className="ml-auto text-text-muted">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="finding-stat-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              Active Scans
            </span>
          </h2>
          <button className="text-xs text-primary hover:underline">View All Jobs →</button>
        </div>
        <div className="space-y-3">
          {activeJobs.map((job) => (
            <div key={job.program} className="flex items-center gap-4 p-3 rounded-lg hover:bg-bg-overlay transition-fast">
              <div className="w-8 h-8 rounded-lg bg-bg-subtle flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary truncate">{job.program}</span>
                  <span className="text-xs text-text-muted shrink-0 ml-2">{job.elapsed}</span>
                </div>
                <div className="text-xs text-text-muted">{job.stage} — {job.tool}</div>
                <div className="mt-1.5 progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${job.progress}%` }} />
                </div>
              </div>
              <button className="text-xs text-text-subtle hover:text-critical transition-fast shrink-0 px-2 py-1 rounded hover:bg-critical-muted">
                Cancel
              </button>
            </div>
          ))}
          {activeJobs.length === 0 && (
            <div className="text-sm text-text-muted text-center py-6">No active scans</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 finding-stat-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Recent Activity</h2>
            <button className="text-xs text-primary hover:underline">View All →</button>
          </div>
          <div className="space-y-1">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-bg-overlay transition-fast">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  item.type === "critical" ? "bg-critical" :
                  item.type === "high" ? "bg-high" :
                  item.type === "medium" ? "bg-medium" :
                  item.type === "success" ? "bg-low" : "bg-info"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary truncate">{item.message}</span>
                    {item.tool && <span className="text-[10px] text-text-muted bg-bg-subtle px-1.5 py-0.5 rounded shrink-0">{item.tool}</span>}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">{item.program}</div>
                </div>
                <span className="text-xs text-text-subtle shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-4 space-y-4">
          <div className="finding-stat-card hover:border-primary transition-fast cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-muted flex items-center justify-center">
                <FolderKanban className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm text-text-primary">New Project</div>
                <div className="text-xs text-text-muted mt-0.5">Create a new bug bounty project</div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted ml-auto" />
            </div>
          </div>
          <div className="finding-stat-card hover:border-accent transition-fast cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
                <Target className="w-5 h-5 text-accent" />
              </div>
              <div>
                <div className="font-semibold text-sm text-text-primary">New Program</div>
                <div className="text-xs text-text-muted mt-0.5">Add a program to an existing project</div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted ml-auto" />
            </div>
          </div>
          <div className="finding-stat-card hover:border-medium transition-fast cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-medium-muted flex items-center justify-center">
                <Users className="w-5 h-5 text-medium" />
              </div>
              <div>
                <div className="font-semibold text-sm text-text-primary">View Unassigned</div>
                <div className="text-xs text-text-muted mt-0.5">18 findings need triage</div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted ml-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

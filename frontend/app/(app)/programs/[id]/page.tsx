"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertTriangle, ChevronDown, Activity, CheckCircle2, XCircle, Clock, Play, Globe, Server, Shield, Bug, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface StageStatus {
  name: string
  label: string
  status: "passed" | "running" | "failed" | "pending"
  lastRun: string | null
  duration: string | null
  findings: number
}

const stages: StageStatus[] = [
  { name: "Stage 1 — Passive", label: "Subdomain discovery & URL collection", status: "passed", lastRun: "2h ago", duration: "4m 30s", findings: 0 },
  { name: "Stage 2 — Validation", label: "Host validation & port scanning", status: "passed", lastRun: "1h ago", duration: "6m 15s", findings: 0 },
  { name: "Stage 3 — Active", label: "Content discovery & parameter analysis", status: "running", lastRun: "30m ago", duration: "12m 40s", findings: 3 },
  { name: "Stage 4 — Vulnerabilities", label: "Vulnerability scanning & nuclei", status: "pending", lastRun: null, duration: null, findings: 0 },
]

const statsCards = [
  { label: "Subdomains", value: "1,247", icon: Globe, color: "primary" },
  { label: "Live Hosts", value: "384", icon: Server, color: "accent" },
  { label: "Open Ports", value: "1,892", icon: Activity, color: "medium" },
  { label: "Findings", value: "28", icon: Bug, color: "critical" },
]

const scanStages = [1, 2, 3, 4]

export default function ProgramDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState(0)
  const [scanMenuOpen, setScanMenuOpen] = useState(false)

  const program = {
    name: "Uber",
    platform: "HackerOne",
    status: "active",
    approved: false,
    url: "https://hackerone.com/uber",
  }

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="text-xs text-text-muted mb-1">Projects / H1 Private Programs / Programs</div>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-bg-subtle flex items-center justify-center text-2xl font-bold text-primary shrink-0">
              U
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
                {program.name}
                <span className="badge bg-primary-muted text-primary">{program.platform}</span>
                <span className="badge bg-low-muted text-low">Active</span>
              </h1>
              <a href={program.url} className="text-xs text-text-muted hover:text-primary mt-1 inline-flex items-center gap-1">
                {program.url} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setScanMenuOpen(!scanMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary rounded-lg text-white text-xs font-medium hover:bg-primary-hover transition-fast shadow-glow-primary"
              >
                <Play className="w-3.5 h-3.5" /> Scan Now <ChevronDown className="w-3 h-3" />
              </button>
              {scanMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-bg-elevated shadow-lg py-1 z-10">
                  {["Stage 1 — Passive", "Stage 2 — Validate", "Stage 3 — Active", "Stage 4 — Vuln", "Full Pipeline"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setScanMenuOpen(false)}
                      className="w-full px-3 py-1.5 text-xs text-left text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-fast"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-bg-overlay transition-fast border border-border">
              Edit
            </button>
          </div>
        </div>

        {!program.approved && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-high-muted border border-high/30 text-sm">
            <AlertTriangle className="w-5 h-5 text-high shrink-0" />
            <div className="flex-1">
              <div className="text-high font-medium">Active scanning not approved</div>
              <div className="text-high/80 text-xs mt-0.5">Stages 3 (Active) and 4 (Vulnerability) are blocked until an admin approves.</div>
            </div>
            <Button variant="ghost" className="text-high border border-high/30 bg-high-muted/50 hover:bg-high-muted shrink-0 text-xs">
              Approve Active Scanning →
            </Button>
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b border-border pb-0">
        {["Overview", "Scope", "Recon", "Findings", "Reports"].map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={cn(
              "px-4 py-2.5 text-xs font-medium transition-all duration-150 border-b-2 -mb-px",
              activeTab === i
                ? "text-primary border-primary"
                : "text-text-muted hover:text-text-secondary border-transparent"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {statsCards.map((stat) => {
              const Icon = stat.icon
              const colorMap: Record<string, string> = {
                primary: "bg-primary-muted text-primary",
                accent: "bg-accent-muted text-accent",
                medium: "bg-medium-muted text-medium",
                critical: "bg-critical-muted text-critical",
              }
              return (
                <div key={stat.label} className="finding-stat-card">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${colorMap[stat.color]} flex items-center justify-center`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-text-primary">{stat.value}</div>
                      <div className="text-xs text-text-muted">{stat.label}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="finding-stat-card">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Pipeline Status</h3>
            <div className="space-y-3">
              {stages.map((stage) => (
                <div key={stage.name} className="flex items-center gap-4 p-3 rounded-lg hover:bg-bg-overlay transition-fast">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                    {stage.status === "passed" && <CheckCircle2 className="w-5 h-5 text-low" />}
                    {stage.status === "running" && (
                      <span className="relative flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-accent" />
                      </span>
                    )}
                    {stage.status === "failed" && <XCircle className="w-5 h-5 text-critical" />}
                    {stage.status === "pending" && <Clock className="w-5 h-5 text-text-subtle" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text-primary">{stage.name}</span>
                      <div className="flex items-center gap-3 text-xs">
                        {stage.lastRun && <span className="text-text-muted">{stage.lastRun}</span>}
                        {stage.duration && <span className="text-text-subtle">{stage.duration}</span>}
                        {stage.findings > 0 && <span className="text-critical">{stage.findings} findings</span>}
                      </div>
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">{stage.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab > 0 && (
        <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-border text-sm text-text-muted">
          {["Scope", "Recon", "Findings", "Reports"][activeTab - 1]} content
        </div>
      )}
    </div>
  )
}

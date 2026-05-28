"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Download, UserCheck, AlertTriangle, ChevronDown, Filter, X } from "lucide-react"
import { cn } from "@/lib/utils"

type Severity = "critical" | "high" | "medium" | "low" | "info"
type Status = "new" | "triaged" | "validated" | "submitted" | "fp" | "dup"

interface Finding {
  id: string
  severity: Severity
  title: string
  host: string
  status: Status
  program: string
  hunter: string
  date: string
  tool: string
}

const findings: Finding[] = [
  { id: "1", severity: "critical", title: "SSRF in api.uber.com/endpoint", host: "api.uber.com", status: "new", program: "Uber — H1", hunter: "—", date: "2m ago", tool: "nuclei" },
  { id: "2", severity: "high", title: "SQL Injection in checkout.php", host: "shop.example.com", status: "triaged", program: "Shopify — Intigriti", hunter: "alice", date: "1h ago", tool: "nuclei" },
  { id: "3", severity: "medium", title: "Reflected XSS in search endpoint", host: "twitter.com", status: "new", program: "Twitter — H1", hunter: "—", date: "3h ago", tool: "nuclei" },
  { id: "4", severity: "high", title: "IDOR in user profile API", host: "api.grab.com", status: "validated", program: "Grab — Bugcrowd", hunter: "bob", date: "6h ago", tool: "katana" },
  { id: "5", severity: "low", title: "CORS misconfiguration", host: "cdn.example.com", status: "new", program: "Acme Corp", hunter: "—", date: "12h ago", tool: "httpx" },
  { id: "6", severity: "critical", title: "RCE in file upload handler", host: "files.example.com", status: "submitted", program: "Uber — H1", hunter: "alice", date: "1d ago", tool: "nuclei" },
  { id: "7", severity: "medium", title: "Open redirect in /auth/callback", host: "auth.uber.com", status: "fp", program: "Uber — H1", hunter: "bob", date: "2d ago", tool: "ffuf" },
  { id: "8", severity: "info", title: "Missing security headers", host: "blog.example.com", status: "new", program: "Shopify — Intigriti", hunter: "—", date: "2d ago", tool: "httpx" },
]

const severityColors: Record<Severity, string> = {
  critical: "bg-critical",
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-low",
  info: "bg-info",
}

const severityTextColors: Record<Severity, string> = {
  critical: "text-critical",
  high: "text-high",
  medium: "text-medium",
  low: "text-low",
  info: "text-info",
}

const severityBgColors: Record<Severity, string> = {
  critical: "bg-critical-muted text-critical border-critical/20",
  high: "bg-high-muted text-high border-high/20",
  medium: "bg-medium-muted text-medium border-medium/20",
  low: "bg-low-muted text-low border-low/20",
  info: "bg-info-muted text-info border-info/20",
}

const statusColors: Record<Status, string> = {
  new: "bg-primary-muted text-primary",
  triaged: "bg-medium-muted text-medium",
  validated: "bg-low-muted text-low",
  submitted: "bg-accent-muted text-accent",
  fp: "bg-critical-muted text-critical",
  dup: "bg-info-muted text-info",
}

export default function FindingsPage() {
  const [search, setSearch] = useState("")
  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>([])

  const toggleSeverity = (s: Severity) => {
    setSelectedSeverities(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  const toggleStatus = (s: Status) => {
    setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  const filtered = findings.filter(f => {
    if (search && !f.title.toLowerCase().includes(search.toLowerCase()) && !f.host.includes(search)) return false
    if (selectedSeverities.length && !selectedSeverities.includes(f.severity)) return false
    if (selectedStatuses.length && !selectedStatuses.includes(f.status)) return false
    return true
  })

  const severityList: Severity[] = ["critical", "high", "medium", "low", "info"]
  const statusList: Status[] = ["new", "triaged", "validated", "submitted", "fp", "dup"]

  return (
    <div className="flex gap-6 h-full">
      <aside className="w-[220px] shrink-0 space-y-5">
        <div>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Filter className="w-3 h-3" /> Filters
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base w-full pl-8 text-xs"
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-2">Severity</h3>
          <div className="space-y-1">
            {severityList.map((s) => (
              <label key={s} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-overlay cursor-pointer transition-fast">
                <input
                  type="checkbox"
                  checked={selectedSeverities.includes(s)}
                  onChange={() => toggleSeverity(s)}
                  className="rounded border-border bg-bg-overlay text-primary focus:ring-primary/30 focus:ring-offset-0 w-3.5 h-3.5"
                />
                <div className={`w-2 h-2 rounded-full ${severityColors[s]}`} />
                <span className="text-xs text-text-secondary capitalize">{s}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-2">Status</h3>
          <div className="space-y-1">
            {statusList.map((s) => (
              <label key={s} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-overlay cursor-pointer transition-fast">
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(s)}
                  onChange={() => toggleStatus(s)}
                  className="rounded border-border bg-bg-overlay text-primary focus:ring-primary/30 focus:ring-offset-0 w-3.5 h-3.5"
                />
                <span className="text-xs text-text-secondary capitalize">{s}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={() => { setSelectedSeverities([]); setSelectedStatuses([]); setSearch("") }}
          className="text-xs text-primary hover:underline w-full text-left"
        >
          Clear all filters
        </button>
      </aside>

      <main className="flex-1 space-y-4 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary">
              Findings
              <span className="ml-2 text-sm font-normal text-text-muted">{filtered.length} total</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary rounded-lg text-white text-xs font-medium hover:bg-primary-hover transition-fast">
              <UserCheck className="w-3.5 h-3.5" /> Assign to me
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-critical-muted text-critical rounded-lg text-xs font-medium hover:bg-critical/20 transition-fast border border-critical/20">
              <AlertTriangle className="w-3.5 h-3.5" /> Mark FP
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-text-secondary rounded-lg text-xs font-medium hover:bg-bg-overlay transition-fast border border-border">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {(selectedSeverities.length > 0 || selectedStatuses.length > 0 || search) && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted">Active filters:</span>
            {selectedSeverities.map(s => (
              <span key={s} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${severityBgColors[s]}`}>
                {s}
                <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => toggleSeverity(s)} />
              </span>
            ))}
            {selectedStatuses.map(s => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-bg-subtle text-text-muted">
                {s}
                <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => toggleStatus(s)} />
              </span>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left font-medium w-8">
                  <input type="checkbox" className="rounded border-border bg-bg-overlay" />
                </th>
                <th className="px-3 py-3 text-left font-medium">Severity</th>
                <th className="px-3 py-3 text-left font-medium">Title</th>
                <th className="px-3 py-3 text-left font-medium">Host</th>
                <th className="px-3 py-3 text-left font-medium">Status</th>
                <th className="px-3 py-3 text-left font-medium">Program</th>
                <th className="px-3 py-3 text-left font-medium">Hunter</th>
                <th className="px-3 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((f) => (
                <tr key={f.id} className="table-row cursor-pointer">
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded border-border bg-bg-overlay" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${severityColors[f.severity]}`} />
                      <span className={`text-xs font-medium capitalize ${severityTextColors[f.severity]}`}>
                        {f.severity}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm text-text-primary font-medium truncate max-w-[280px]">
                      {f.title}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-text-secondary font-mono">{f.host}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${statusColors[f.status]}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-text-muted">{f.program}</td>
                  <td className="px-3 py-3 text-xs text-text-muted">{f.hunter}</td>
                  <td className="px-3 py-3 text-xs text-text-subtle">{f.date}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-text-muted">
                    No findings match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Bug, ExternalLink } from "lucide-react"

const findings = [
  { id: "f1", severity: "critical", title: "SSRF in api.uber.com/internal/health", host: "api.uber.com", status: "new", hunter: "hunter1", date: "2025-04-10" },
  { id: "f2", severity: "high", title: "SQLi at /rides/search?q=", host: "www.uber.com", status: "validated", hunter: "hunter2", date: "2025-04-09" },
  { id: "f3", severity: "medium", title: "XSS in /profile/display-name", host: "www.uber.com", status: "submitted", hunter: "hunter1", date: "2025-04-08" },
  { id: "f4", severity: "low", title: "Missing CORS headers on /api/*", host: "api.uber.com", status: "fp", hunter: "hunter3", date: "2025-04-07" },
  { id: "f5", severity: "info", title: "Debug endpoint exposed /api/docs", host: "developers.uber.com", status: "new", hunter: "hunter2", date: "2025-04-06" },
]

const severityColors: Record<string, string> = {
  critical: "bg-severity-critical text-white",
  high: "bg-severity-high text-white",
  medium: "bg-severity-medium text-white",
  low: "bg-severity-low text-white",
  info: "bg-severity-info text-white",
}

const statusColors: Record<string, string> = {
  new: "bg-primary-muted text-primary",
  validated: "bg-accent-muted text-accent",
  submitted: "bg-severity-medium/10 text-severity-medium",
  fp: "bg-bg-subtle text-text-muted",
}

export default function ProgramFindingsPage() {
  const params = useParams()
  const [search, setSearch] = useState("")

  return (
    <div className="flex gap-6">
      <aside className="w-[220px] flex-shrink-0 space-y-5">
        <h2 className="font-semibold text-sm text-text-primary">Filters</h2>
        <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-base w-full" />

        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Severity</h3>
          {["critical", "high", "medium", "low", "info"].map((sev) => (
            <div key={sev} className="flex items-center gap-2">
              <Checkbox id={`sev-${sev}`} />
              <Label htmlFor={`sev-${sev}`} className="capitalize text-sm">{sev}</Label>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Status</h3>
          {["new", "validated", "submitted", "fp"].map((st) => (
            <div key={st} className="flex items-center gap-2">
              <Checkbox id={`st-${st}`} />
              <Label htmlFor={`st-${st}`} className="capitalize text-sm">{st}</Label>
            </div>
          ))}
        </div>

        <Button variant="ghost" className="w-full text-text-muted text-xs">Clear Filters</Button>
      </aside>

      <main className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-text-primary">
            Findings <span className="text-text-muted text-sm font-normal">5 total in this program</span>
          </h1>
          <div className="flex gap-2">
            <Button className="btn-primary">Assign to me</Button>
            <Button variant="ghost">Export CSV</Button>
          </div>
        </div>

        <Card className="bg-bg-elevated border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left w-20">Severity</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Host</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Hunter</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {findings.map((f) => (
                <tr key={f.id} className="hover:bg-bg-overlay cursor-pointer">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${severityColors[f.severity]}`}>
                      <AlertTriangle className="w-3 h-3" />
                      {f.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-primary font-medium">{f.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{f.host}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${statusColors[f.status]}`}>{f.status}</span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{f.hunter}</td>
                  <td className="px-4 py-3 text-text-muted">{f.date}</td>
                  <td className="px-4 py-3 text-right">
                    <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  )
}

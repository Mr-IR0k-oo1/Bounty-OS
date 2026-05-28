"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Globe, Bug, CheckCircle2, TrendingUp, Activity, Filter } from "lucide-react"

const events = [
  { id: "e1", type: "program_added", description: "Uber (HackerOne) added to project", user: "admin", time: "2025-04-10 09:00", severity: null },
  { id: "e2", type: "scan_started", description: "nuclei scan started on Uber", user: "system", time: "2025-04-10 09:05", severity: null },
  { id: "e3", type: "scan_complete", description: "nuclei scan completed — 38 findings", user: "system", time: "2025-04-10 09:15", severity: null },
  { id: "e4", type: "finding_discovered", description: "Critical: SSRF on api.uber.com", user: "nuclei", time: "2025-04-10 09:15", severity: "critical" },
  { id: "e5", type: "finding_discovered", description: "High: SQLi on /rides/search", user: "nuclei", time: "2025-04-10 09:15", severity: "high" },
  { id: "e6", type: "program_added", description: "Airbnb (Bugcrowd) added to project", user: "admin", time: "2025-04-10 10:00", severity: null },
  { id: "e7", type: "scan_started", description: "subfinder scan started on Airbnb", user: "system", time: "2025-04-10 10:05", severity: null },
  { id: "e8", type: "submitted", description: "SSRF finding submitted to Uber", user: "hunter1", time: "2025-04-11 09:00", severity: "critical" },
  { id: "e9", type: "bounty_received", description: "Bounty received: $2,500 for SSRF", user: "hunter1", time: "2025-04-14 14:00", severity: null },
  { id: "e10", type: "finding_discovered", description: "Medium: XSS on www.uber.com", user: "katana", time: "2025-04-12 11:30", severity: "medium" },
  { id: "e11", type: "submitted", description: "SQLi finding submitted to Uber", user: "hunter2", time: "2025-04-13 10:00", severity: "high" },
  { id: "e12", type: "bounty_received", description: "Bounty received: $1,000 for SQLi", user: "hunter2", time: "2025-04-16 16:00", severity: null },
]

const typeConfig: Record<string, { icon: React.ReactNode; label: string }> = {
  program_added: { icon: <Globe className="w-3.5 h-3.5" />, label: "Program Added" },
  scan_started: { icon: <Activity className="w-3.5 h-3.5" />, label: "Scan Started" },
  scan_complete: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Scan Complete" },
  finding_discovered: { icon: <Bug className="w-3.5 h-3.5" />, label: "Finding Discovered" },
  submitted: { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Submitted" },
  bounty_received: { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Bounty Received" },
}

const severityDot: Record<string, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
}

export default function ProjectTimelinePage() {
  const params = useParams()
  const projectId = params.projectId as string
  const [typeFilter, setTypeFilter] = useState("all")
  const [severityFilter, setSeverityFilter] = useState("all")
  const [hunterFilter, setHunterFilter] = useState("all")

  const filtered = events.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false
    if (severityFilter !== "all" && e.severity !== severityFilter) return false
    if (hunterFilter !== "all" && e.user !== hunterFilter) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
        <a href={`/projects/${projectId}`} className="hover:text-text-primary">Project</a>
        <span>/</span>
        <span className="text-text-primary">Timeline</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Timeline</h1>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-xs text-text-muted">Filters:</span>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="program_added">Program Added</SelectItem>
            <SelectItem value="scan_started">Scan Started</SelectItem>
            <SelectItem value="scan_complete">Scan Complete</SelectItem>
            <SelectItem value="finding_discovered">Finding Discovered</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="bounty_received">Bounty Received</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="All Severities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={hunterFilter} onValueChange={setHunterFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="All Users" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
            <SelectItem value="system">system</SelectItem>
            <SelectItem value="hunter1">hunter1</SelectItem>
            <SelectItem value="hunter2">hunter2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="relative">
        <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-1">
          {filtered.map((event) => {
            const config = typeConfig[event.type] || { icon: <Clock className="w-3.5 h-3.5" />, label: event.type }
            return (
              <div key={event.id} className="relative flex gap-4 py-2.5 pl-0">
                <div className="flex-shrink-0 w-10 flex justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-bg-elevated border-2 border-border z-10 mt-1" />
                </div>
                <Card className="flex-1 bg-bg-elevated border border-border p-3 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-text-muted">{config.icon}</span>
                    <span className="text-xs font-medium text-text-muted">{config.label}</span>
                    {event.severity && (
                      <span className={`w-2 h-2 rounded-full ${severityDot[event.severity] || "bg-bg-subtle"}`} />
                    )}
                    {event.severity && (
                      <span className="text-[10px] text-text-muted capitalize">{event.severity}</span>
                    )}
                  </div>
                  <p className="text-sm text-text-primary">{event.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-text-muted">
                    <span>by {event.user}</span>
                    <span>{event.time}</span>
                  </div>
                </Card>
              </div>
            )
          })}
        </div>
      </div>

      {filtered.length === 0 && (
        <Card className="p-8 bg-bg-elevated border border-border text-center">
          <p className="text-text-muted text-sm">No events match the current filters</p>
          <Button variant="ghost" size="sm" className="mt-2">Clear Filters</Button>
        </Card>
      )}
    </div>
  )
}

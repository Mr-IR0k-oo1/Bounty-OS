"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Search, Download, UserCheck, AlertTriangle, ChevronDown, 
  Filter, X, Plus, CheckCircle, Shield, ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import type { Severity, FindingStatus } from "@/lib/types"

interface DisplayFinding {
  id: string
  severity: Severity
  title: string
  host: string
  status: FindingStatus
  program: string
  hunter: string
  date: string
  tool: string
}

const initialFindings: DisplayFinding[] = [
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

const statusColors: Record<FindingStatus, string> = {
  new: "bg-primary-muted text-primary",
  triaged: "bg-medium-muted text-medium",
  validated: "bg-low-muted text-low",
  submitted: "bg-accent-muted text-accent",
  fp: "bg-critical-muted text-critical",
  dup: "bg-info-muted text-info",
  na: "bg-bg-subtle text-text-muted",
  bounty_awarded: "bg-emerald-500/20 text-emerald-400"
}

export default function FindingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [findingsList, setFindingsList] = useState<DisplayFinding[]>(initialFindings)
  const [search, setSearch] = useState("")
  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<FindingStatus[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [newModalOpen, setNewModalOpen] = useState(false)

  // New Finding Form
  const [newTitle, setNewTitle] = useState("")
  const [newHost, setNewHost] = useState("")
  const [newProgram, setNewProgram] = useState("Uber — H1")
  const [newSeverity, setNewSeverity] = useState<Severity>("high")
  const [newTool, setNewTool] = useState("manual")
  const [newDescription, setNewDescription] = useState("")

  const toggleSeverity = (s: Severity) => {
    setSelectedSeverities(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  const toggleStatus = (s: FindingStatus) => {
    setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map(f => f.id))
    }
  }

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleAssignToMe = () => {
    if (selectedIds.length === 0) {
      toast({ title: "No findings selected", description: "Select one or more findings to assign." })
      return
    }
    setFindingsList(prev => prev.map(f => selectedIds.includes(f.id) ? { ...f, hunter: "admin" } : f))
    toast({ title: "Findings assigned", description: `Assigned ${selectedIds.length} finding(s) to you.` })
    setSelectedIds([])
  }

  const handleMarkFp = () => {
    if (selectedIds.length === 0) {
      toast({ title: "No findings selected", description: "Select one or more findings to mark as false positive." })
      return
    }
    setFindingsList(prev => prev.map(f => selectedIds.includes(f.id) ? { ...f, status: "fp" } : f))
    toast({ title: "Updated to False Positive", description: `Marked ${selectedIds.length} finding(s) as FP.` })
    setSelectedIds([])
  }

  const handleMarkValidated = () => {
    if (selectedIds.length === 0) {
      toast({ title: "No findings selected", description: "Select one or more findings to validate." })
      return
    }
    setFindingsList(prev => prev.map(f => selectedIds.includes(f.id) ? { ...f, status: "validated" } : f))
    toast({ title: "Findings Validated", description: `Marked ${selectedIds.length} finding(s) as validated.` })
    setSelectedIds([])
  }

  const handleExportCsv = () => {
    const toExport = selectedIds.length > 0 
      ? findingsList.filter(f => selectedIds.includes(f.id))
      : filtered

    const csvRows = [
      ["ID", "Severity", "Title", "Host", "Status", "Program", "Hunter", "Date", "Tool"],
      ...toExport.map(f => [f.id, f.severity, `"${f.title.replace(/"/g, '""')}"`, f.host, f.status, `"${f.program}"`, f.hunter, f.date, f.tool])
    ]
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `bountyos_findings_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: "Export complete", description: `Exported ${toExport.length} finding(s) to CSV.` })
  }

  const handleCreateFinding = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newHost.trim()) return

    const created: DisplayFinding = {
      id: String(Date.now()),
      severity: newSeverity,
      title: newTitle.trim(),
      host: newHost.trim(),
      status: "new",
      program: newProgram,
      hunter: "admin",
      date: "Just now",
      tool: newTool
    }

    setFindingsList(prev => [created, ...prev])
    setNewTitle("")
    setNewHost("")
    setNewDescription("")
    setNewModalOpen(false)
    toast({ title: "Finding logged", description: `Successfully created "${created.title}".` })
  }

  const filtered = findingsList.filter(f => {
    if (search && !f.title.toLowerCase().includes(search.toLowerCase()) && !f.host.includes(search)) return false
    if (selectedSeverities.length && !selectedSeverities.includes(f.severity)) return false
    if (selectedStatuses.length && !selectedStatuses.includes(f.status)) return false
    return true
  })

  const severityList: Severity[] = ["critical", "high", "medium", "low", "info"]
  const statusList: FindingStatus[] = ["new", "triaged", "validated", "submitted", "fp", "dup"]

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar Filters */}
      <aside className="w-[230px] shrink-0 space-y-5">
        <div>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Filter className="w-3 h-3" /> Filters
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search findings or host..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base w-full pl-8 text-xs bg-bg-elevated border-border"
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
                <span className="text-xs text-text-secondary capitalize">{s.replace("_", " ")}</span>
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

      {/* Main Content Area */}
      <main className="flex-1 space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
              Vulnerability Findings
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-muted text-primary">
                {filtered.length} total
              </span>
            </h1>
            <p className="text-xs text-text-muted mt-0.5">Triaged and aggregated security issues across active scopes.</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setNewModalOpen(true)}
              className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-glow-primary"
              size="sm"
            >
              <Plus className="w-3.5 h-3.5" /> Log Finding
            </Button>

            <button
              onClick={handleAssignToMe}
              disabled={selectedIds.length === 0}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-fast border border-border",
                selectedIds.length > 0 
                  ? "bg-bg-elevated text-text-primary hover:bg-bg-overlay cursor-pointer" 
                  : "bg-bg-subtle text-text-muted cursor-not-allowed opacity-50"
              )}
            >
              <UserCheck className="w-3.5 h-3.5 text-primary" /> Assign ({selectedIds.length})
            </button>

            <button
              onClick={handleMarkValidated}
              disabled={selectedIds.length === 0}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-fast border border-low/30",
                selectedIds.length > 0 
                  ? "bg-low-muted text-low hover:bg-low/20 cursor-pointer" 
                  : "bg-bg-subtle text-text-muted cursor-not-allowed opacity-50"
              )}
            >
              <CheckCircle className="w-3.5 h-3.5" /> Validate
            </button>

            <button
              onClick={handleMarkFp}
              disabled={selectedIds.length === 0}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-fast border border-critical/30",
                selectedIds.length > 0 
                  ? "bg-critical-muted text-critical hover:bg-critical/20 cursor-pointer" 
                  : "bg-bg-subtle text-text-muted cursor-not-allowed opacity-50"
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Mark FP
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-text-secondary rounded-lg text-xs font-medium hover:bg-bg-overlay transition-fast border border-border bg-bg-elevated"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Filter tags bar */}
        {(selectedSeverities.length > 0 || selectedStatuses.length > 0 || search) && (
          <div className="flex items-center gap-2 flex-wrap p-2.5 rounded-xl bg-bg-elevated border border-border">
            <span className="text-xs text-text-muted font-medium">Active filters:</span>
            {selectedSeverities.map(s => (
              <span key={s} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${severityBgColors[s]}`}>
                {s}
                <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-75" onClick={() => toggleSeverity(s)} />
              </span>
            ))}
            {selectedStatuses.map(s => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-bg-subtle text-text-muted border border-border">
                {s.replace("_", " ")}
                <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-75" onClick={() => toggleStatus(s)} />
              </span>
            ))}
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary-muted text-primary">
                &quot;{search}&quot;
                <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-75" onClick={() => setSearch("")} />
              </span>
            )}
          </div>
        )}

        {/* Findings Table */}
        <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header border-b border-border bg-bg-subtle/60">
                <th className="px-4 py-3 text-left font-medium w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={toggleSelectAll}
                    className="rounded border-border bg-bg-overlay text-primary focus:ring-0"
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium text-xs text-text-muted uppercase tracking-wider">Severity</th>
                <th className="px-3 py-3 text-left font-medium text-xs text-text-muted uppercase tracking-wider">Title</th>
                <th className="px-3 py-3 text-left font-medium text-xs text-text-muted uppercase tracking-wider">Host</th>
                <th className="px-3 py-3 text-left font-medium text-xs text-text-muted uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left font-medium text-xs text-text-muted uppercase tracking-wider">Program</th>
                <th className="px-3 py-3 text-left font-medium text-xs text-text-muted uppercase tracking-wider">Hunter</th>
                <th className="px-3 py-3 text-left font-medium text-xs text-text-muted uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((f) => {
                const isSelected = selectedIds.includes(f.id)
                return (
                  <tr
                    key={f.id}
                    onClick={() => router.push(`/findings/${f.id}`)}
                    className={cn(
                      "table-row cursor-pointer transition-colors group",
                      isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-bg-overlay/60"
                    )}
                  >
                    <td className="px-4 py-3" onClick={(e) => toggleSelectOne(f.id, e)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-border bg-bg-overlay text-primary focus:ring-0"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${severityColors[f.severity]}`} />
                        <span className={`text-xs font-semibold capitalize ${severityTextColors[f.severity]}`}>
                          {f.severity}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm text-text-primary font-medium group-hover:text-primary transition-colors truncate max-w-[300px]">
                        {f.title}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs text-text-secondary font-mono bg-bg-subtle px-1.5 py-0.5 rounded border border-border/50">
                        {f.host}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${statusColors[f.status]}`}>
                        {f.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-text-muted">{f.program}</td>
                    <td className="px-3 py-3 text-xs text-text-muted">
                      {f.hunter === "—" ? <span className="text-text-subtle">Unassigned</span> : f.hunter}
                    </td>
                    <td className="px-3 py-3 text-xs text-text-subtle whitespace-nowrap">{f.date}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-sm text-text-muted">
                    <AlertTriangle className="w-8 h-8 text-text-muted/40 mx-auto mb-2" />
                    No findings match your current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* New Finding Modal */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-bg-elevated border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <h3 className="text-base font-semibold text-text-primary">Log New Finding</h3>
              </div>
              <button
                onClick={() => setNewModalOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-overlay"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateFinding} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Vulnerability Title</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Remote Code Execution via Deserialization"
                  className="bg-bg-subtle border-border text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-text-secondary">Target Host / URL</Label>
                  <Input
                    value={newHost}
                    onChange={(e) => setNewHost(e.target.value)}
                    placeholder="api.target.com"
                    className="bg-bg-subtle border-border text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-text-secondary">Program</Label>
                  <Input
                    value={newProgram}
                    onChange={(e) => setNewProgram(e.target.value)}
                    className="bg-bg-subtle border-border text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-text-secondary">Severity</Label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as Severity)}
                    className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-xs text-text-primary"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="info">Info</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-text-secondary">Discovery Tool</Label>
                  <Input
                    value={newTool}
                    onChange={(e) => setNewTool(e.target.value)}
                    placeholder="manual / nuclei / burp"
                    className="bg-bg-subtle border-border text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Description & PoC Details</Label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Detailed reproduction steps and impact..."
                  className="bg-bg-subtle border-border text-xs min-h-[90px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-primary hover:bg-primary-hover text-white text-xs"
                >
                  Save Finding
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


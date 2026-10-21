"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Search, Download, UserCheck, AlertTriangle, ChevronDown, 
  Filter, X, Plus, CheckCircle, Shield, ExternalLink, RefreshCw, Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/useToast"
import { api } from "@/lib/api"
import type { Severity, FindingStatus, Finding, Program } from "@/lib/types"

interface DisplayFinding {
  id: string
  severity: Severity
  title: string
  host: string
  status: FindingStatus
  program: string
  programId: string
  hunter: string
  date: string
  tool: string
  description?: string | null
}

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
  const [findingsList, setFindingsList] = useState<DisplayFinding[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<FindingStatus[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // New Finding Form
  const [newTitle, setNewTitle] = useState("")
  const [newHost, setNewHost] = useState("")
  const [newProgramId, setNewProgramId] = useState("")
  const [newSeverity, setNewSeverity] = useState<Severity>("high")
  const [newTool, setNewTool] = useState("manual")
  const [newDescription, setNewDescription] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rawFindings, progList] = await Promise.all([
        api.listFindings().catch(() => []),
        api.listPrograms().catch(() => []),
      ])

      setPrograms(progList || [])
      if (progList && progList.length > 0 && !newProgramId) {
        setNewProgramId(progList[0].id)
      }

      const progMap = new Map<string, string>()
      progList?.forEach((p) => progMap.set(p.id, p.name))

      const formatted: DisplayFinding[] = (rawFindings || []).map((f: any) => {
        const pId = f.program_id || f.programId || ""
        const pName = progMap.get(pId) || f.program?.name || "Program"
        const dt = f.created_at || f.foundAt
        return {
          id: String(f.id),
          severity: (f.severity || "info").toLowerCase() as Severity,
          title: f.title || "Untitled Finding",
          host: f.matched_at || (f as any).host || "Target Host",
          status: (f.status || "new").toLowerCase() as FindingStatus,
          program: pName,
          programId: pId,
          hunter: f.assigned_to ? "Assigned" : "—",
          date: dt ? new Date(dt).toLocaleDateString([], { month: "short", day: "numeric" }) : "Recently",
          tool: f.tool || f.finding_type || "manual",
          description: f.description,
        }
      })

      setFindingsList(formatted)
    } catch (e: any) {
      setError(e.message || "Failed to load findings")
    } finally {
      setLoading(false)
    }
  }, [newProgramId])

  useEffect(() => {
    loadData()
  }, [loadData])

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

  const handleAssignToMe = async () => {
    if (selectedIds.length === 0) {
      toast({ title: "No findings selected", description: "Select one or more findings to assign." })
      return
    }
    try {
      await Promise.all(selectedIds.map(id => api.claimFinding(id).catch(() => null)))
      toast({ title: "Findings Assigned", description: `Assigned ${selectedIds.length} finding(s) to you.` })
      setSelectedIds([])
      loadData()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Assignment failed", description: e.message })
    }
  }

  const handleMarkFp = async () => {
    if (selectedIds.length === 0) {
      toast({ title: "No findings selected", description: "Select one or more findings to mark as false positive." })
      return
    }
    try {
      await Promise.all(selectedIds.map(id => api.updateFinding(id, { status: "fp" }).catch(() => null)))
      toast({ title: "Marked False Positive", description: `Updated ${selectedIds.length} finding(s).` })
      setSelectedIds([])
      loadData()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e.message })
    }
  }

  const handleMarkValidated = async () => {
    if (selectedIds.length === 0) {
      toast({ title: "No findings selected", description: "Select one or more findings to validate." })
      return
    }
    try {
      await Promise.all(selectedIds.map(id => api.validateFinding(id).catch(() => null)))
      toast({ title: "Findings Validated", description: `Validated ${selectedIds.length} finding(s).` })
      setSelectedIds([])
      loadData()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Validation failed", description: e.message })
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    try {
      await Promise.all(selectedIds.map(id => api.deleteFinding(id).catch(() => null)))
      toast({ title: "Findings Deleted", description: `Deleted ${selectedIds.length} finding(s).` })
      setSelectedIds([])
      loadData()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Delete failed", description: e.message })
    }
  }

  const handleExportCsv = () => {
    const toExport = selectedIds.length > 0 
      ? findingsList.filter(f => selectedIds.includes(f.id))
      : filtered

    const csvRows = [
      ["ID", "Severity", "Title", "Host", "Status", "Program", "Hunter", "Date", "Tool"],
      ...toExport.map(f => [f.id, f.severity, `"${f.title.replace(/"/g, '""')}"`, f.host, f.status, f.program, f.hunter, f.date, f.tool])
    ]
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `bountyos-findings-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: "Export complete", description: `Exported ${toExport.length} findings to CSV.` })
  }

  const handleCreateFinding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    const targetProgId = newProgramId || (programs[0] ? programs[0].id : "")
    if (!targetProgId) {
      toast({ variant: "destructive", title: "No Program Available", description: "Please create a program first." })
      return
    }

    setIsSubmitting(true)
    try {
      await api.createFinding({
        program_id: targetProgId,
        title: newTitle.trim(),
        matched_at: newHost.trim() || undefined,
        severity: newSeverity,
        finding_type: newTool,
        description: newDescription.trim() || undefined,
        status: "new",
      })

      setNewModalOpen(false)
      setNewTitle("")
      setNewHost("")
      setNewDescription("")
      toast({ title: "Finding Recorded", description: "Vulnerability saved to program records." })
      loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Creation Failed", description: err.message || "Could not save finding" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const filtered = useMemo(() => {
    return findingsList
      .filter(f => !search || f.title.toLowerCase().includes(search.toLowerCase()) || f.host.toLowerCase().includes(search.toLowerCase()))
      .filter(f => selectedSeverities.length === 0 || selectedSeverities.includes(f.severity))
      .filter(f => selectedStatuses.length === 0 || selectedStatuses.includes(f.status))
  }, [findingsList, search, selectedSeverities, selectedStatuses])

  const stats = {
    critical: findingsList.filter(f => f.severity === "critical").length,
    high: findingsList.filter(f => f.severity === "high").length,
    medium: findingsList.filter(f => f.severity === "medium").length,
    low: findingsList.filter(f => f.severity === "low").length,
    info: findingsList.filter(f => f.severity === "info").length,
  }

  return (
    <div className="flex gap-6">
      {/* Left Sidebar — Severity Filters */}
      <aside className="w-56 shrink-0 space-y-4">
        <div className="bg-bg-elevated border border-border rounded-xl p-3.5 space-y-2">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Severity</h3>
          {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => {
            const isSelected = selectedSeverities.includes(s)
            return (
              <button
                key={s}
                onClick={() => toggleSeverity(s)}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  isSelected ? severityBgColors[s] : "hover:bg-bg-overlay text-text-secondary"
                )}
              >
                <div className="flex items-center gap-2 capitalize">
                  <div className={`w-2 h-2 rounded-full ${severityColors[s]}`} />
                  {s}
                </div>
                <span className="font-mono text-text-muted text-[11px]">{stats[s]}</span>
              </button>
            )
          })}
        </div>

        {/* Status Filter */}
        <div className="bg-bg-elevated border border-border rounded-xl p-3.5 space-y-2">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Status</h3>
          {(["new", "triaged", "validated", "submitted", "fp"] as FindingStatus[]).map((st) => {
            const isSelected = selectedStatuses.includes(st)
            const count = findingsList.filter(f => f.status === st).length
            return (
              <button
                key={st}
                onClick={() => toggleStatus(st)}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
                  isSelected ? "bg-bg-subtle text-text-primary border border-border" : "hover:bg-bg-overlay text-text-secondary"
                )}
              >
                <span>{st.replace("_", " ")}</span>
                <span className="font-mono text-text-muted text-[11px]">{count}</span>
              </button>
            )
          })}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 space-y-4">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              Vulnerability Findings
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-muted text-primary">
                {findingsList.length}
              </span>
            </h1>
            <p className="text-xs text-text-muted mt-1">Real-time vulnerability pipeline across all enrolled target programs.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData()}
              disabled={loading}
              className="gap-1.5 text-xs text-text-primary"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} /> Refresh
            </Button>
            <Button onClick={() => setNewModalOpen(true)} className="btn-primary text-xs gap-1.5">
              <Plus className="w-4 h-4" /> New Finding
            </Button>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-bg-elevated border border-border p-3 rounded-xl">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Filter findings by title or host..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base pl-9 text-xs w-full bg-bg-base border-border"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAssignToMe}
              disabled={selectedIds.length === 0}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-fast border border-border",
                selectedIds.length > 0 ? "bg-bg-overlay hover:bg-bg-subtle text-text-primary cursor-pointer" : "bg-bg-subtle text-text-muted cursor-not-allowed opacity-50"
              )}
            >
              <UserCheck className="w-3.5 h-3.5 text-primary" /> Assign to Me
            </button>

            <button
              onClick={handleMarkValidated}
              disabled={selectedIds.length === 0}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-fast border border-low/30",
                selectedIds.length > 0 ? "bg-low-muted text-low hover:bg-low/20 cursor-pointer" : "bg-bg-subtle text-text-muted cursor-not-allowed opacity-50"
              )}
            >
              <CheckCircle className="w-3.5 h-3.5" /> Validate
            </button>

            <button
              onClick={handleMarkFp}
              disabled={selectedIds.length === 0}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-fast border border-critical/30",
                selectedIds.length > 0 ? "bg-critical-muted text-critical hover:bg-critical/20 cursor-pointer" : "bg-bg-subtle text-text-muted cursor-not-allowed opacity-50"
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Mark FP
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-fast border border-critical/20",
                selectedIds.length > 0 ? "bg-critical-muted text-critical hover:bg-critical/30 cursor-pointer" : "bg-bg-subtle text-text-muted cursor-not-allowed opacity-50"
              )}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
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
                    onClick={() => router.push(`/programs/${f.programId}?tab=findings`)}
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${statusColors[f.status] || "bg-bg-subtle text-text-muted"}`}>
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
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-sm text-text-muted">
                    <AlertTriangle className="w-8 h-8 text-text-muted/40 mx-auto mb-2" />
                    No findings found in the database. Run scans or log a finding to populate.
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
                <Label className="text-xs text-text-secondary">Target Program *</Label>
                <select
                  value={newProgramId}
                  onChange={(e) => setNewProgramId(e.target.value)}
                  className="input-base text-xs bg-bg-base border-border w-full py-2 px-3 rounded-lg"
                  required
                >
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Vulnerability Title *</Label>
                <Input
                  required
                  placeholder="e.g. Broken Access Control in /api/v1/workspaces"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="text-xs bg-bg-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-text-secondary">Affected Host / URL</Label>
                  <Input
                    placeholder="e.g. api.example.com"
                    value={newHost}
                    onChange={(e) => setNewHost(e.target.value)}
                    className="text-xs bg-bg-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-text-secondary">Severity</Label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as Severity)}
                    className="input-base text-xs bg-bg-base border-border w-full py-2 px-3 rounded-lg capitalize"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="info">Info</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Description & Reproduction Steps</Label>
                <Textarea
                  placeholder="Proof of Concept, curl commands, headers, and impact..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={4}
                  className="text-xs bg-bg-base"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="ghost" size="sm" onClick={() => setNewModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} size="sm" className="btn-primary">
                  {isSubmitting ? "Saving..." : "Save Finding"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

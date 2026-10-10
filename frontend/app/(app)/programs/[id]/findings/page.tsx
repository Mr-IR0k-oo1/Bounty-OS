"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { AlertTriangle, AlertCircle, RefreshCw, ExternalLink } from "lucide-react"
import { api } from "@/lib/api"
import type { Finding } from "@/lib/types"

const severityColors: Record<string, string> = {
  critical: "bg-severity-critical text-white",
  high: "bg-severity-high text-white",
  medium: "bg-severity-medium text-white",
  low: "bg-severity-low text-white",
  info: "bg-severity-info text-white",
}

const statusColors: Record<string, string> = {
  new: "bg-primary-muted text-primary",
  triaged: "bg-primary-muted text-primary",
  validated: "bg-accent-muted text-accent",
  submitted: "bg-severity-medium/10 text-severity-medium",
  fp: "bg-bg-subtle text-text-muted",
}

export default function ProgramFindingsPage() {
  const params = useParams()
  const programId = params.id as string

  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])

  const fetchFindings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listProgramFindings(programId)
      setFindings(data)
    } catch (e: any) {
      setError(e.message || "Failed to load program findings")
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    fetchFindings()
  }, [fetchFindings])

  const toggleSeverity = (sev: string) => {
    setSelectedSeverities((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
    )
  }

  const toggleStatus = (st: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
    )
  }

  const filtered = findings
    .filter((f) => !search || f.title.toLowerCase().includes(search.toLowerCase()))
    .filter((f) => selectedSeverities.length === 0 || selectedSeverities.includes((f.severity || "").toLowerCase()))
    .filter((f) => selectedStatuses.length === 0 || selectedStatuses.includes((f.status || "").toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link href={`/programs/${programId}`} className="hover:text-text-primary">Program</Link>
        <span>/</span>
        <span className="text-text-primary">Findings</span>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-severity-critical/30 bg-severity-critical/10 flex items-center justify-between gap-3 text-sm text-text-primary">
          <div className="flex items-center gap-2 text-severity-critical">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Failed to load findings: {error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchFindings()} className="gap-1.5 text-xs text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <aside className="w-full md:w-[220px] shrink-0 space-y-5">
          <h2 className="font-semibold text-sm text-text-primary">Filters</h2>
          <Input
            placeholder="Search findings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base w-full text-xs"
          />

          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Severity</h3>
            {["critical", "high", "medium", "low", "info"].map((sev) => (
              <div key={sev} className="flex items-center gap-2">
                <Checkbox
                  id={`sev-${sev}`}
                  checked={selectedSeverities.includes(sev)}
                  onCheckedChange={() => toggleSeverity(sev)}
                />
                <Label htmlFor={`sev-${sev}`} className="capitalize text-xs cursor-pointer">
                  {sev}
                </Label>
              </div>
            ))}
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Status</h3>
            {["new", "triaged", "validated", "submitted", "fp"].map((st) => (
              <div key={st} className="flex items-center gap-2">
                <Checkbox
                  id={`st-${st}`}
                  checked={selectedStatuses.includes(st)}
                  onCheckedChange={() => toggleStatus(st)}
                />
                <Label htmlFor={`st-${st}`} className="capitalize text-xs cursor-pointer">
                  {st}
                </Label>
              </div>
            ))}
          </div>

          <Button
            variant="ghost"
            onClick={() => { setSelectedSeverities([]); setSelectedStatuses([]); setSearch("") }}
            className="w-full text-text-muted text-xs"
          >
            Clear Filters
          </Button>
        </aside>

        <main className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-text-primary">
              Findings <span className="text-text-muted text-sm font-normal">({filtered.length} total in this program)</span>
            </h1>
            <div className="flex gap-2">
              <Link href={`/findings`}>
                <Button variant="ghost" size="sm" className="text-xs">All Findings</Button>
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="p-8 bg-bg-elevated border border-border rounded-xl animate-pulse h-64" />
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center bg-bg-elevated border border-border text-xs text-text-muted">
              {search || selectedSeverities.length > 0 || selectedStatuses.length > 0
                ? "No findings match the selected filter criteria."
                : "No vulnerability findings reported yet for this program."}
            </Card>
          ) : (
            <Card className="bg-bg-elevated border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left w-24">Severity</th>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Endpoint / Host</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Discovered</th>
                    <th className="px-4 py-3 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((f) => {
                    const sev = (f.severity || "info").toLowerCase()
                    const st = (f.status || "new").toLowerCase()
                    const matched = f.matched_at || f.title
                    const dateStr = f.created_at ? new Date(f.created_at).toLocaleDateString() : (f.foundAt || "-")

                    return (
                      <tr key={f.id} className="hover:bg-bg-overlay">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium capitalize ${severityColors[sev] || severityColors.info}`}>
                            <AlertTriangle className="w-3 h-3" />
                            {sev}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-primary font-medium text-xs">
                          <Link href={`/findings/${f.id}`} className="hover:text-primary transition-colors">
                            {f.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-text-secondary max-w-[200px] truncate">
                          {matched}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge text-xs capitalize ${statusColors[st] || "bg-bg-subtle text-text-muted"}`}>
                            {st}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-muted text-xs">{dateStr}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/findings/${f.id}`}>
                            <ExternalLink className="w-3.5 h-3.5 text-text-muted hover:text-primary transition-colors inline-block" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}

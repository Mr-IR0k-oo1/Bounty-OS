"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Upload, X, Globe, Server, Monitor, Database, AlertCircle, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/useToast"
import type { ScopeTarget, ScopeType } from "@/lib/types"

const typeIcons: Record<string, any> = { domain: Globe, ip: Server, url: Monitor, cidr: Database, wildcard: Globe }

export default function ProgramScopePage() {
  const params = useParams()
  const programId = params.id as string
  const { toast } = useToast()

  const [targets, setTargets] = useState<ScopeTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<"in" | "out" | null>(null)
  const [showImport, setShowImport] = useState<"in" | "out" | null>(null)
  const [importText, setImportText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ type: "domain" as ScopeType, target: "", notes: "" })

  const fetchScope = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listScope(programId)
      setTargets(data)
    } catch (e: any) {
      setError(e.message || "Failed to load scope")
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    fetchScope()
  }, [fetchScope])

  const inScope = targets.filter((t) => !t.out_of_scope && t.inScope !== false)
  const outScope = targets.filter((t) => t.out_of_scope || t.inScope === false)

  async function handleAddTarget(scope: "in" | "out") {
    if (!form.target.trim()) return
    setSubmitting(true)
    try {
      const isOut = scope === "out"
      const created = await api.addScope(programId, {
        target: form.target.trim(),
        target_type: form.type,
        out_of_scope: isOut,
        source: "manual",
        notes: form.notes || null,
      })
      setTargets((prev) => [...prev, created])
      setForm({ type: "domain", target: "", notes: "" })
      setAddingTo(null)
      toast({ title: "Scope target added", description: `${created.target || created.targetValue} added to scope.` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error adding target", description: e.message })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemoveTarget(id: string) {
    try {
      await api.deleteScope(id)
      setTargets((prev) => prev.filter((t) => t.id !== id))
      toast({ title: "Target removed", description: "Target removed from scope." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error removing target", description: e.message })
    }
  }

  async function handleImport(scope: "in" | "out") {
    const lines = importText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length === 0) return
    setSubmitting(true)
    try {
      const res = await api.importScope(programId, lines, scope === "out")
      toast({ title: "Import complete", description: `Imported ${res.imported_count} targets.` })
      setShowImport(null)
      setImportText("")
      await fetchScope()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Import failed", description: e.message })
    } finally {
      setSubmitting(false)
    }
  }

  function renderTable(title: string, data: ScopeTarget[], scope: "in" | "out") {
    return (
      <Card className="bg-bg-elevated border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">
            {title} <span className="text-xs text-text-muted font-normal">({data.length})</span>
          </h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setAddingTo(scope); setShowImport(null) }}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Target
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowImport(scope); setAddingTo(null) }}>
              <Upload className="w-3.5 h-3.5 mr-1" /> Import
            </Button>
          </div>
        </div>

        {addingTo === scope && (
          <div className="flex flex-wrap items-end gap-3 p-4 bg-bg-subtle border-b border-border">
            <div className="space-y-1.5">
              <label className="text-xs text-text-muted">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as ScopeType })}
                className="input-base h-9 rounded-md border border-border bg-bg-elevated px-3 text-sm"
              >
                <option value="domain">Domain</option>
                <option value="wildcard">Wildcard</option>
                <option value="ip">IP</option>
                <option value="url">URL</option>
                <option value="cidr">CIDR</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <label className="text-xs text-text-muted">Target</label>
              <Input
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                placeholder="*.example.com or 10.0.0.0/24"
              />
            </div>
            <div className="flex-1 min-w-[150px] space-y-1.5">
              <label className="text-xs text-text-muted">Notes</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
            <Button size="sm" onClick={() => handleAddTarget(scope)} disabled={!form.target || submitting}>
              {submitting ? "Adding..." : "Add"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAddingTo(null)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {showImport === scope && (
          <div className="p-4 bg-bg-subtle border-b border-border space-y-3">
            <label className="text-xs text-text-muted">Paste targets (one per line):</label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={4}
              placeholder="*.example.com&#10;api.example.com&#10;192.168.1.0/24"
              className="w-full rounded-md border border-border bg-bg-elevated p-2 text-xs font-mono text-text-primary"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowImport(null)}>Cancel</Button>
              <Button size="sm" onClick={() => handleImport(scope)} disabled={!importText.trim() || submitting}>
                {submitting ? "Importing..." : "Run Import"}
              </Button>
            </div>
          </div>
        )}

        {data.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted">
            No {scope === "in" ? "in-scope" : "out-of-scope"} targets defined.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
              <tr>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-left">Target</th>
                <th className="px-4 py-2.5 text-left">Notes / Source</th>
                <th className="px-4 py-2.5 text-left">Added</th>
                <th className="px-4 py-2.5 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((item) => {
                const typeStr = item.target_type || item.targetType || "domain"
                const targetStr = item.target || item.targetValue || ""
                const notesStr = item.notes || item.source || "-"
                const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : (item.addedAt || "-")
                const Icon = typeIcons[typeStr] || Globe

                return (
                  <tr key={item.id} className="hover:bg-bg-overlay">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5 text-text-secondary capitalize text-xs">
                        <Icon className="w-3.5 h-3.5" /> {typeStr}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-text-primary">{targetStr}</td>
                    <td className="px-4 py-2.5 text-text-muted text-xs">{notesStr}</td>
                    <td className="px-4 py-2.5 text-text-muted text-xs">{dateStr}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => handleRemoveTarget(item.id)} className="text-text-muted hover:text-severity-high">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
        <Link href={`/programs/${programId}`} className="hover:text-text-primary">Program</Link>
        <span>/</span>
        <span className="text-text-primary">Scope</span>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-severity-critical/30 bg-severity-critical/10 flex items-center justify-between gap-3 text-sm text-text-primary">
          <div className="flex items-center gap-2 text-severity-critical">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Failed to load scope: {error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchScope()} className="gap-1.5 text-xs text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="p-8 bg-bg-elevated border border-border rounded-xl animate-pulse h-48" />
          <div className="p-8 bg-bg-elevated border border-border rounded-xl animate-pulse h-48" />
        </div>
      ) : (
        <>
          {renderTable("In-Scope Targets", inScope, "in")}
          {renderTable("Out-of-Scope Targets", outScope, "out")}
        </>
      )}
    </div>
  )
}

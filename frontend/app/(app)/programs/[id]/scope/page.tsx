"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Upload, X, Globe, Server, Monitor, Database } from "lucide-react"

type Target = {
  id: string
  type: "domain" | "ip" | "url" | "cidr"
  target: string
  notes: string
  addedBy: string
  date: string
}

const typeIcons = { domain: Globe, ip: Server, url: Monitor, cidr: Database }

const initialInScope: Target[] = [
  { id: "1", type: "domain", target: "*.uber.com", notes: "Main domain", addedBy: "admin", date: "2025-04-01" },
  { id: "2", type: "ip", target: "10.0.0.0/24", notes: "Internal range", addedBy: "admin", date: "2025-04-02" },
  { id: "3", type: "url", target: "https://auth.uber.com/*", notes: "Auth endpoints", addedBy: "hunter1", date: "2025-04-03" },
]

const initialOutScope: Target[] = [
  { id: "4", type: "domain", target: "*.corp.uber.com", notes: "Corporate network", addedBy: "admin", date: "2025-04-01" },
  { id: "5", type: "cidr", target: "192.168.0.0/16", notes: "RFC 1918", addedBy: "admin", date: "2025-04-01" },
]

export default function ProgramScopePage() {
  const params = useParams()
  const [inScope, setInScope] = useState(initialInScope)
  const [outScope, setOutScope] = useState(initialOutScope)
  const [addingTo, setAddingTo] = useState<"in" | "out" | null>(null)
  const [form, setForm] = useState({ type: "domain" as Target["type"], target: "", notes: "" })

  function addTarget(scope: "in" | "out") {
    const newTarget: Target = {
      id: crypto.randomUUID(),
      ...form,
      addedBy: "current-user",
      date: new Date().toISOString().split("T")[0],
    }
    if (scope === "in") setInScope((prev) => [...prev, newTarget])
    else setOutScope((prev) => [...prev, newTarget])
    setForm({ type: "domain", target: "", notes: "" })
    setAddingTo(null)
  }

  function removeTarget(id: string, scope: "in" | "out") {
    if (scope === "in") setInScope((prev) => prev.filter((t) => t.id !== id))
    else setOutScope((prev) => prev.filter((t) => t.id !== id))
  }

  function renderTable(title: string, data: Target[], scope: "in" | "out") {
    return (
      <Card className="bg-bg-elevated border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAddingTo(scope)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Target
            </Button>
            <Button variant="ghost" size="sm">
              <Upload className="w-3.5 h-3.5 mr-1" /> Import
            </Button>
          </div>
        </div>

        {addingTo === scope && (
          <div className="flex items-end gap-3 p-4 bg-bg-subtle border-b border-border">
            <div className="space-y-1.5">
              <label className="text-xs text-text-muted">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Target["type"] })}
                className="input-base h-9 rounded-md border border-border bg-bg-elevated px-3 text-sm"
              >
                <option value="domain">Domain</option>
                <option value="ip">IP Range</option>
                <option value="url">URL</option>
                <option value="cidr">CIDR</option>
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs text-text-muted">Target</label>
              <Input
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                placeholder="*.example.com"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs text-text-muted">Notes</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
            <Button size="sm" onClick={() => addTarget(scope)} disabled={!form.target}>Add</Button>
            <Button variant="ghost" size="sm" onClick={() => setAddingTo(null)}><X className="w-3.5 h-3.5" /></Button>
          </div>
        )}

        <table className="w-full text-sm">
          <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
            <tr>
              <th className="px-4 py-2.5 text-left">Type</th>
              <th className="px-4 py-2.5 text-left">Target</th>
              <th className="px-4 py-2.5 text-left">Notes</th>
              <th className="px-4 py-2.5 text-left">Added By</th>
              <th className="px-4 py-2.5 text-left">Date</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((item) => {
              const Icon = typeIcons[item.type]
              return (
                <tr key={item.id} className="hover:bg-bg-overlay">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <Icon className="w-3.5 h-3.5" /> {item.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-text-primary">{item.target}</td>
                  <td className="px-4 py-2.5 text-text-muted">{item.notes}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{item.addedBy}</td>
                  <td className="px-4 py-2.5 text-text-muted">{item.date}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => removeTarget(item.id, scope)} className="text-text-muted hover:text-severity-high">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
        <a href={`/programs/${params.id}`} className="hover:text-text-primary">Program</a>
        <span>/</span>
        <span className="text-text-primary">Scope</span>
      </div>

      {renderTable("In-Scope Targets", inScope, "in")}
      {renderTable("Out-of-Scope Targets", outScope, "out")}
    </div>
  )
}

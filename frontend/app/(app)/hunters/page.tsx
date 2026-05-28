"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Shield, Plus, CheckCircle2, XCircle, MoreHorizontal } from "lucide-react"

type Hunter = {
  id: string
  username: string
  displayName: string
  role: "admin" | "hunter" | "viewer"
  twoFactor: boolean
  lastLogin: string
  active: boolean
}

const initialHunters: Hunter[] = [
  { id: "h1", username: "admin", displayName: "Admin User", role: "admin", twoFactor: true, lastLogin: "2m ago", active: true },
  { id: "h2", username: "hunter1", displayName: "Alice Smith", role: "hunter", twoFactor: true, lastLogin: "15m ago", active: true },
  { id: "h3", username: "hunter2", displayName: "Bob Jones", role: "hunter", twoFactor: false, lastLogin: "1h ago", active: true },
  { id: "h4", username: "hunter3", displayName: "Carol White", role: "hunter", twoFactor: true, lastLogin: "1d ago", active: true },
  { id: "h5", username: "viewer1", displayName: "Dave Brown", role: "viewer", twoFactor: false, lastLogin: "3d ago", active: false },
]

const roleColors: Record<string, string> = {
  admin: "bg-severity-high/10 text-severity-high",
  hunter: "bg-primary-muted text-primary",
  viewer: "bg-bg-subtle text-text-muted",
}

export default function HuntersPage() {
  const [hunters, setHunters] = useState(initialHunters)
  const [showAdd, setShowAdd] = useState(false)

  function toggleActive(id: string) {
    setHunters((prev) => prev.map((h) => (h.id === id ? { ...h, active: !h.active } : h)))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-text-primary">Hunters</h1>
          <span className="text-sm text-text-muted">{hunters.length} total</span>
        </div>
        <Button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Hunter
        </Button>
      </div>

      <Card className="bg-bg-elevated border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Display Name</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">2FA</th>
              <th className="px-4 py-3 text-left">Last Login</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {hunters.map((h) => (
              <tr key={h.id} className="hover:bg-bg-overlay">
                <td className="px-4 py-3 font-mono text-xs text-text-primary">{h.username}</td>
                <td className="px-4 py-3 text-text-secondary">{h.displayName}</td>
                <td className="px-4 py-3">
                  <span className={`badge text-xs capitalize ${roleColors[h.role]}`}>{h.role}</span>
                </td>
                <td className="px-4 py-3">
                  {h.twoFactor ? (
                    <CheckCircle2 className="w-4 h-4 text-accent" />
                  ) : (
                    <XCircle className="w-4 h-4 text-text-muted" />
                  )}
                </td>
                <td className="px-4 py-3 text-text-muted">{h.lastLogin}</td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1.5 text-xs ${h.active ? "text-accent" : "text-text-muted"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${h.active ? "bg-accent" : "bg-text-subtle"}`} />
                    {h.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(h.id)}>
                      {h.active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                    <button className="text-text-muted hover:text-text-primary">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowAdd(false)}>
          <Card className="w-full max-w-md p-6 bg-bg-elevated border border-border" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Add Hunter</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-text-secondary">Username</label>
                <Input placeholder="Choose a username" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-text-secondary">Display Name</label>
                <Input placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-text-secondary">Role</label>
                <select className="input-base h-9 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm">
                  <option value="hunter">Hunter</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-text-secondary">Temporary Password</label>
                <Input placeholder="Auto-generated" disabled />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button>Add Hunter</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

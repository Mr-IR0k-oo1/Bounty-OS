"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Shield, Plus, CheckCircle2, XCircle, MoreHorizontal, 
  UserCheck, UserX, Edit3, Trash2, X, KeyRound
} from "lucide-react"
import { useToast } from "@/hooks/useToast"
import { cn } from "@/lib/utils"

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
  { id: "h1", username: "admin", displayName: "Admin User", role: "admin", twoFactor: true, lastLogin: "Just now", active: true },
  { id: "h2", username: "hunter1", displayName: "Alice Smith", role: "hunter", twoFactor: true, lastLogin: "15m ago", active: true },
  { id: "h3", username: "hunter2", displayName: "Bob Jones", role: "hunter", twoFactor: false, lastLogin: "1h ago", active: true },
  { id: "h4", username: "hunter3", displayName: "Carol White", role: "hunter", twoFactor: true, lastLogin: "1d ago", active: true },
  { id: "h5", username: "viewer1", displayName: "Dave Brown", role: "viewer", twoFactor: false, lastLogin: "3d ago", active: false },
]

const roleColors: Record<string, string> = {
  admin: "bg-critical-muted text-critical border border-critical/20",
  hunter: "bg-primary-muted text-primary border border-primary/20",
  viewer: "bg-bg-subtle text-text-muted border border-border",
}

export default function HuntersPage() {
  const { toast } = useToast()
  const [hunters, setHunters] = useState<Hunter[]>(initialHunters)
  const [showAdd, setShowAdd] = useState(false)
  const [editingHunter, setEditingHunter] = useState<Hunter | null>(null)

  // Add Hunter Form
  const [addUsername, setAddUsername] = useState("")
  const [addDisplayName, setAddDisplayName] = useState("")
  const [addRole, setAddRole] = useState<"admin" | "hunter" | "viewer">("hunter")

  function toggleActive(id: string) {
    setHunters((prev) =>
      prev.map((h) => {
        if (h.id === id) {
          const updatedActive = !h.active
          toast({
            title: updatedActive ? "Hunter Activated" : "Hunter Deactivated",
            description: `${h.displayName} (${h.username}) is now ${updatedActive ? "active" : "inactive"}.`
          })
          return { ...h, active: updatedActive }
        }
        return h
      })
    )
  }

  function handleCreateHunter(e: React.FormEvent) {
    e.preventDefault()
    if (!addUsername.trim() || !addDisplayName.trim()) return

    const newHunter: Hunter = {
      id: `h-${Date.now()}`,
      username: addUsername.trim().toLowerCase(),
      displayName: addDisplayName.trim(),
      role: addRole,
      twoFactor: false,
      lastLogin: "Never",
      active: true
    }

    setHunters((prev) => [newHunter, ...prev])
    setAddUsername("")
    setAddDisplayName("")
    setShowAdd(false)
    toast({
      title: "Hunter Created",
      description: `${newHunter.displayName} added with role ${newHunter.role}. Invitation link generated.`
    })
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingHunter) return

    setHunters((prev) => prev.map((h) => (h.id === editingHunter.id ? editingHunter : h)))
    toast({ title: "Hunter Updated", description: `Saved details for ${editingHunter.displayName}.` })
    setEditingHunter(null)
  }

  function handleDeleteHunter(id: string) {
    const target = hunters.find((h) => h.id === id)
    if (!target) return
    setHunters((prev) => prev.filter((h) => h.id !== id))
    toast({ title: "Hunter Removed", description: `${target.displayName} was removed from the system.` })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-text-primary">Team & Hunters</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-muted text-primary">
              {hunters.length} members
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">Manage operators, permissions, and multi-factor authentication.</p>
        </div>

        <Button
          onClick={() => setShowAdd(true)}
          className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-glow-primary self-start sm:self-auto"
          size="sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add New Hunter
        </Button>
      </div>

      <Card className="bg-bg-elevated border border-border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header border-b border-border bg-bg-subtle/50 text-[10px] font-bold text-text-muted uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Display Name</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">2FA Status</th>
              <th className="px-4 py-3 text-left">Last Login</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {hunters.map((h) => (
              <tr key={h.id} className="hover:bg-bg-overlay/50 transition-colors">
                <td className="px-4 py-3.5 font-mono text-xs text-text-primary font-medium">
                  {h.username}
                </td>
                <td className="px-4 py-3.5 text-xs text-text-secondary">{h.displayName}</td>
                <td className="px-4 py-3.5">
                  <span className={`badge text-[10px] font-bold uppercase tracking-wider ${roleColors[h.role]}`}>
                    {h.role}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  {h.twoFactor ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-low font-medium">
                      <CheckCircle2 className="w-4 h-4 text-low" /> Enforced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                      <XCircle className="w-4 h-4 text-text-subtle" /> Not configured
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-xs text-text-muted">{h.lastLogin}</td>
                <td className="px-4 py-3.5">
                  <span className={cn(
                    "badge text-[10px] font-semibold flex items-center gap-1.5 w-fit",
                    h.active ? "bg-low-muted text-low border border-low/20" : "bg-bg-subtle text-text-muted border border-border"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", h.active ? "bg-low" : "bg-text-muted")} />
                    {h.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(h.id)}
                      className="text-xs border-border bg-bg-subtle hover:bg-bg-overlay h-7 px-2"
                    >
                      {h.active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingHunter(h)}
                      className="text-xs border-border bg-bg-subtle hover:bg-bg-overlay h-7 px-2"
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    {h.username !== "admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteHunter(h.id)}
                        className="text-xs border-critical/30 text-critical hover:bg-critical-muted h-7 px-2"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Add Hunter Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-md bg-bg-elevated border border-border shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <h3 className="text-base font-semibold text-text-primary">Add Team Member</h3>
              </div>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateHunter} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Username</Label>
                <Input
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  placeholder="e.g. jdoe"
                  className="bg-bg-subtle border-border text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Full Display Name</Label>
                <Input
                  value={addDisplayName}
                  onChange={(e) => setAddDisplayName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="bg-bg-subtle border-border text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Role Permission</Label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as any)}
                  className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-xs text-text-primary"
                >
                  <option value="hunter">Hunter (Scan, triage findings, write reports)</option>
                  <option value="viewer">Viewer (Read-only findings & recon)</option>
                  <option value="admin">Admin (Full system access & settings)</option>
                </select>
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-text-secondary">
                A temporary credential will be created. The hunter will be required to set up TOTP two-factor authentication upon first login.
              </div>
              <div className="flex gap-2 justify-end pt-3 border-t border-border">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary hover:bg-primary-hover text-white text-xs">
                  Create Hunter
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Edit Hunter Modal */}
      {editingHunter && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-md bg-bg-elevated border border-border shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-primary" />
                <h3 className="text-base font-semibold text-text-primary">Edit Member</h3>
              </div>
              <button onClick={() => setEditingHunter(null)} className="p-1 rounded-lg text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Display Name</Label>
                <Input
                  value={editingHunter.displayName}
                  onChange={(e) => setEditingHunter({ ...editingHunter, displayName: e.target.value })}
                  className="bg-bg-subtle border-border text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Role</Label>
                <select
                  value={editingHunter.role}
                  onChange={(e) => setEditingHunter({ ...editingHunter, role: e.target.value as any })}
                  className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-xs text-text-primary"
                >
                  <option value="hunter">Hunter</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-bg-subtle border border-border">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-text-primary">Enforce Two-Factor Auth</div>
                  <div className="text-[11px] text-text-muted">Require TOTP authenticator app</div>
                </div>
                <input
                  type="checkbox"
                  checked={editingHunter.twoFactor}
                  onChange={(e) => setEditingHunter({ ...editingHunter, twoFactor: e.target.checked })}
                  className="rounded border-border text-primary"
                />
              </div>
              <div className="flex gap-2 justify-end pt-3 border-t border-border">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingHunter(null)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary hover:bg-primary-hover text-white text-xs">
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}


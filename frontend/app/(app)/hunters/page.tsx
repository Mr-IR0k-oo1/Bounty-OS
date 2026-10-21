"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Shield, Plus, CheckCircle2, XCircle, 
  Edit3, Trash2, X, RefreshCw
} from "lucide-react"
import { useToast } from "@/hooks/useToast"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import type { Hunter } from "@/lib/types"

const roleColors: Record<string, string> = {
  admin: "bg-critical-muted text-critical border border-critical/20",
  hunter: "bg-primary-muted text-primary border border-primary/20",
  viewer: "bg-bg-subtle text-text-muted border border-border",
}

export default function HuntersPage() {
  const { toast } = useToast()
  const [hunters, setHunters] = useState<Hunter[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingHunter, setEditingHunter] = useState<Hunter | null>(null)

  // Add Hunter Form
  const [addUsername, setAddUsername] = useState("")
  const [addDisplayName, setAddDisplayName] = useState("")
  const [addEmail, setAddEmail] = useState("")
  const [addRole, setAddRole] = useState<"admin" | "hunter">("hunter")
  const [addPassword, setAddPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadHunters = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.listHunters()
      setHunters(data || [])
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to load hunters", description: e.message })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadHunters()
  }, [loadHunters])

  async function toggleActive(hunter: Hunter) {
    const updatedActive = !hunter.active
    try {
      await api.updateHunter(hunter.id, { active: updatedActive })
      setHunters((prev) =>
        prev.map((h) => (h.id === hunter.id ? { ...h, active: updatedActive } : h))
      )
      toast({
        title: updatedActive ? "Hunter Activated" : "Hunter Deactivated",
        description: `${hunter.displayName} (${hunter.username}) is now ${updatedActive ? "active" : "inactive"}.`
      })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Status update failed", description: e.message })
    }
  }

  async function handleCreateHunter(e: React.FormEvent) {
    e.preventDefault()
    if (!addUsername.trim() || !addDisplayName.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const created = await api.createHunter({
        username: addUsername.trim().toLowerCase(),
        display_name: addDisplayName.trim(),
        email: addEmail.trim() || undefined,
        role: addRole,
        password: addPassword.trim() || "hunter123",
      })

      setHunters((prev) => [...prev, created])
      setAddUsername("")
      setAddDisplayName("")
      setAddEmail("")
      setAddPassword("")
      setShowAdd(false)
      toast({
        title: "Hunter Created",
        description: `${created.displayName} has been added successfully.`
      })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to create hunter", description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingHunter) return

    try {
      const updated = await api.updateHunter(editingHunter.id, {
        displayName: editingHunter.displayName,
        role: editingHunter.role,
        active: editingHunter.active,
      })
      setHunters((prev) => prev.map((h) => (h.id === updated.id ? updated : h)))
      toast({ title: "Hunter Updated", description: `Saved details for ${updated.displayName}.` })
      setEditingHunter(null)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e.message })
    }
  }

  async function handleDeleteHunter(id: string) {
    const target = hunters.find((h) => h.id === id)
    if (!target) return
    try {
      await api.deleteHunter(id)
      setHunters((prev) => prev.filter((h) => h.id !== id))
      toast({ title: "Hunter Removed", description: `${target.displayName} was removed.` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Delete failed", description: e.message })
    }
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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadHunters()}
            disabled={loading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} /> Refresh
          </Button>
          <Button
            onClick={() => setShowAdd(true)}
            className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-glow-primary self-start sm:self-auto"
            size="sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add New Hunter
          </Button>
        </div>
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
                  <span className={`badge text-[10px] font-bold uppercase tracking-wider ${roleColors[h.role] || "bg-bg-subtle text-text-muted"}`}>
                    {h.role}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  {h.totpEnabled ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-low font-medium">
                      <CheckCircle2 className="w-4 h-4 text-low" /> Enforced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                      <XCircle className="w-4 h-4 text-text-subtle" /> Not configured
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-xs text-text-muted">
                  {h.lastLogin ? new Date(h.lastLogin).toLocaleDateString() : "Just now"}
                </td>
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
                      onClick={() => toggleActive(h)}
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
            {!loading && hunters.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-text-muted">
                  No hunters found.
                </td>
              </tr>
            )}
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
                <Label className="text-xs text-text-secondary">Username *</Label>
                <Input
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  placeholder="e.g. hunter2"
                  className="bg-bg-subtle border-border text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Full Display Name *</Label>
                <Input
                  value={addDisplayName}
                  onChange={(e) => setAddDisplayName(e.target.value)}
                  placeholder="e.g. Alice Smith"
                  className="bg-bg-subtle border-border text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Email Address (Optional)</Label>
                <Input
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="hunter@bountyos.local"
                  className="bg-bg-subtle border-border text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Password (Optional - defaults to hunter123)</Label>
                <Input
                  type="password"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-bg-subtle border-border text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-text-secondary">Role Permission</Label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as any)}
                  className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-xs text-text-primary"
                >
                  <option value="hunter">Hunter (Full Scan & Scope Operator)</option>
                  <option value="admin">Administrator (System & Program Management)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} size="sm" className="btn-primary">
                  {isSubmitting ? "Adding..." : "Add Hunter"}
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
              <h3 className="text-base font-semibold text-text-primary">Edit Hunter: {editingHunter.username}</h3>
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
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingHunter(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="btn-primary">
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

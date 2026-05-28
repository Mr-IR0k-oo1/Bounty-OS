"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Users, Plus, X, User, Shield, Bug, FileText } from "lucide-react"

type Hunter = {
  id: string
  name: string
  role: string
  avatar: string
  findingsClaimed: number
  findingsValidated: number
  findingsSubmitted: number
}

const initialTeam: Hunter[] = [
  { id: "h1", name: "Alice Smith", role: "Lead Hunter", avatar: "AS", findingsClaimed: 34, findingsValidated: 28, findingsSubmitted: 12 },
  { id: "h2", name: "Bob Jones", role: "Hunter", avatar: "BJ", findingsClaimed: 22, findingsValidated: 18, findingsSubmitted: 8 },
  { id: "h3", name: "Carol White", role: "Hunter", avatar: "CW", findingsClaimed: 15, findingsValidated: 12, findingsSubmitted: 5 },
  { id: "h4", name: "Dave Brown", role: "Viewer", avatar: "DB", findingsClaimed: 0, findingsValidated: 0, findingsSubmitted: 0 },
]

export default function ProjectTeamPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const [team, setTeam] = useState(initialTeam)
  const [showAssign, setShowAssign] = useState(false)

  function removeHunter(id: string) {
    setTeam((prev) => prev.filter((h) => h.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
        <a href={`/projects/${projectId}`} className="hover:text-text-primary">Project</a>
        <span>/</span>
        <span className="text-text-primary">Team</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Team <span className="text-sm font-normal text-text-muted">{team.length} members</span>
        </h1>
        <Button onClick={() => setShowAssign(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Assign Hunter
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {team.map((hunter) => (
          <Card key={hunter.id} className="p-5 bg-bg-elevated border border-border hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-muted flex items-center justify-center text-sm font-semibold text-primary">
                  {hunter.avatar}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{hunter.name}</h3>
                  <span className="badge bg-bg-subtle text-text-muted text-xs mt-0.5 inline-block">{hunter.role}</span>
                </div>
              </div>
              <button
                onClick={() => removeHunter(hunter.id)}
                className="text-text-muted hover:text-severity-high transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-5">
              <div className="text-center p-3 rounded-md bg-bg-subtle">
                <Bug className="w-4 h-4 text-primary mx-auto mb-1" />
                <div className="text-lg font-bold text-text-primary">{hunter.findingsClaimed}</div>
                <div className="text-[10px] text-text-muted">Claimed</div>
              </div>
              <div className="text-center p-3 rounded-md bg-bg-subtle">
                <Shield className="w-4 h-4 text-accent mx-auto mb-1" />
                <div className="text-lg font-bold text-text-primary">{hunter.findingsValidated}</div>
                <div className="text-[10px] text-text-muted">Validated</div>
              </div>
              <div className="text-center p-3 rounded-md bg-bg-subtle">
                <FileText className="w-4 h-4 text-severity-medium mx-auto mb-1" />
                <div className="text-lg font-bold text-text-primary">{hunter.findingsSubmitted}</div>
                <div className="text-[10px] text-text-muted">Submitted</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {showAssign && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowAssign(false)}>
          <Card className="w-full max-w-sm p-6 bg-bg-elevated border border-border" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Assign Hunter</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-text-secondary">Hunter</label>
                <select className="input-base h-9 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm">
                  {team.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                  <option value="new">+ New Hunter...</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-text-secondary">Role in Project</label>
                <select className="input-base h-9 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm">
                  <option value="lead">Lead Hunter</option>
                  <option value="hunter">Hunter</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShowAssign(false)}>Cancel</Button>
                <Button onClick={() => setShowAssign(false)}>Assign</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

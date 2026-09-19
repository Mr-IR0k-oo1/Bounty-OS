"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  FolderKanban,
  Globe,
  Bug,
  Users,
  FileText,
  Clock,
  TrendingUp,
  Activity,
  Plus,
  ArrowRight,
  Shield,
  Calendar,
  CheckCircle2,
  XCircle,
  X,
  ExternalLink,
} from "lucide-react"
import { KanbanBoard } from "@/components/projects/KanbanBoard"
import { ProjectNotes } from "@/components/projects/ProjectNotes"
import { ProjectTimeline } from "@/components/projects/ProjectTimeline"
import { ProgramForm } from "@/components/programs/ProgramForm"
import { useToast } from "@/hooks/useToast"
import { cn } from "@/lib/utils"

export default function ProjectOverviewPage() {
  const params = useParams()
  const projectId = (params.projectId as string) || "1"
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"overview" | "programs" | "kanban" | "notes" | "timeline" | "team">("overview")

  const [projectData, setProjectData] = useState({
    name: "Q1 2025 Engagements",
    status: "Active",
    description: "Top-tier private invite-only bug bounty engagements and assets.",
  })

  // Programs state
  const [programsList, setProgramsList] = useState([
    { id: "1", name: "Uber", platform: "HackerOne", status: "active", targets: 142, lastScan: "2m ago" },
    { id: "2", name: "Airbnb", platform: "Bugcrowd", status: "active", targets: 89, lastScan: "15m ago" },
    { id: "3", name: "Twitter", platform: "HackerOne", status: "active", targets: 203, lastScan: "1h ago" },
  ])

  // Notes state
  const defaultHunter: any = {
    id: "h1",
    username: "admin",
    displayName: "Admin Hunter",
    role: "admin",
    totpEnabled: true,
    active: true,
    lastLogin: "Just now",
    createdAt: "2025-01-01T00:00:00Z",
  }

  const [notesList, setNotesList] = useState<any[]>([
    {
      id: "n1",
      projectId,
      hunterId: "h1",
      title: "Recon & Scope Strategy",
      content: "## Recon Strategy\n\n- Subdomain enumeration using subfinder with passive sources\n- Active validation with httpx\n- Exclude `corp.*` and internal testing endpoints.",
      tags: ["methodology", "scope"],
      createdBy: defaultHunter,
      createdAt: "2025-02-01T10:00:00Z",
      updatedAt: "2025-02-15T14:30:00Z",
    },
    {
      id: "n2",
      projectId,
      hunterId: "h1",
      title: "High Value Endpoints",
      content: "### API Endpoints\n\n- `/api/v1/auth/oauth/token`\n- `/internal/health?url=` (SSRF candidate)\n- `/checkout/cart/apply-coupon`",
      tags: ["endpoints", "findings"],
      createdBy: defaultHunter,
      createdAt: "2025-02-10T12:00:00Z",
      updatedAt: "2025-02-18T09:15:00Z",
    },
  ])

  // Timeline state
  const [timelineEvents, setTimelineEvents] = useState<any[]>([
    { id: "e1", type: "scan", message: "Stage 2 Validation completed on Uber", timestamp: "2025-04-10T14:23:00Z", programName: "Uber" },
    { id: "e2", type: "finding", message: "Critical SSRF discovered on api.uber.com", timestamp: "2025-04-10T14:25:00Z", programName: "Uber", severity: "critical" },
    { id: "e3", type: "submission", message: "Report submitted to HackerOne: SSRF", timestamp: "2025-04-11T09:15:00Z", programName: "Uber" },
    { id: "e4", type: "bounty", message: "Bounty awarded: $2,500 on Uber SSRF", timestamp: "2025-04-12T16:00:00Z", programName: "Uber" },
    { id: "e5", type: "status_change", message: "Project milestones updated for Q1", timestamp: "2025-04-13T10:00:00Z" },
  ])

  // Team state
  const [teamMembers, setTeamMembers] = useState([
    { id: "h1", username: "admin", displayName: "Admin Hunter", role: "admin", twoFactor: true, lastLogin: "Just now" },
    { id: "h2", username: "hunter1", displayName: "Alice Smith", role: "hunter", twoFactor: true, lastLogin: "15m ago" },
    { id: "h3", username: "hunter2", displayName: "Bob Jones", role: "hunter", twoFactor: false, lastLogin: "1h ago" },
    { id: "h4", username: "hunter3", displayName: "Carol White", role: "hunter", twoFactor: true, lastLogin: "1d ago" },
  ])

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [newMemberUsername, setNewMemberUsername] = useState("")

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "programs", label: "Programs" },
    { key: "kanban", label: "Kanban" },
    { key: "notes", label: "Notes" },
    { key: "timeline", label: "Timeline" },
    { key: "team", label: "Team" },
  ]

  const handleSaveNote = async (note: any) => {
    const updated = {
      id: note.id || `n-${Date.now()}`,
      projectId,
      hunterId: "h1",
      title: note.title || "Untitled Note",
      content: note.content || "",
      tags: note.tags || ["general"],
      createdBy: defaultHunter,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setNotesList((prev) => {
      const idx = prev.findIndex((n) => n.id === updated.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = updated
        return next
      }
      return [updated, ...prev]
    })
    toast({ title: "Note saved", description: `"${updated.title}" was saved successfully.` })
  }

  const handleDeleteNote = async (id: string) => {
    setNotesList((prev) => prev.filter((n) => n.id !== id))
    toast({ title: "Note deleted", description: "The note has been removed." })
  }

  const handleAddProgramSubmit = async (data: any) => {
    const newProg = {
      id: String(Date.now()),
      name: data.name,
      platform: data.platform === "h1" ? "HackerOne" : data.platform === "bugcrowd" ? "Bugcrowd" : data.platform === "intigriti" ? "Intigriti" : "Other",
      status: "active",
      targets: 0,
      lastScan: "Just now",
    }
    setProgramsList((prev) => [newProg, ...prev])
    setIsAddProgramOpen(false)
    toast({ title: "Program added", description: `${data.name} added to ${projectData.name}.` })
  }

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberUsername.trim()) return
    const newMem = {
      id: `h-${Date.now()}`,
      username: newMemberUsername.toLowerCase().replace(/\s+/g, ""),
      displayName: newMemberUsername,
      role: "hunter",
      twoFactor: false,
      lastLogin: "Never",
    }
    setTeamMembers((prev) => [...prev, newMem])
    setNewMemberUsername("")
    setIsAddMemberOpen(false)
    toast({ title: "Hunter assigned", description: `${newMemberUsername} joined this project.` })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-text-muted mb-1 flex items-center gap-1.5">
            <Link href="/projects" className="hover:text-text-primary">Projects</Link>
            <span>/</span>
            <span className="text-text-primary font-medium">{projectData.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <FolderKanban className="w-6 h-6 text-primary" />
            {projectData.name}
            <span className={cn(
              "badge text-xs",
              projectData.status === "Active" ? "bg-accent-muted text-accent" : "bg-bg-subtle text-text-muted"
            )}>
              {projectData.status}
            </span>
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setIsEditModalOpen(true)}>Edit</Button>
          <Button
            className="btn-primary"
            onClick={() => {
              setProjectData((prev) => ({ ...prev, status: prev.status === "Active" ? "Archived" : "Active" }))
              toast({ title: "Status updated", description: `Project is now ${projectData.status === "Active" ? "Archived" : "Active"}.` })
            }}
          >
            {projectData.status === "Active" ? "Archive Project" : "Activate Project"}
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-bg-subtle rounded-xl w-fit border border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              activeTab === tab.key
                ? "bg-bg-elevated text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-12 gap-6 animate-in fade-in duration-150">
          <div className="col-span-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: "Programs", value: String(programsList.length), icon: Globe, color: "text-primary" },
              { label: "Total Findings", value: "47", icon: Bug, color: "text-critical" },
              { label: "Hunters", value: String(teamMembers.length), icon: Users, color: "text-accent" },
              { label: "Submitted", value: "12", icon: FileText, color: "text-medium" },
              { label: "Bounties Earned", value: "$8,500", icon: TrendingUp, color: "text-low" },
            ].map((stat) => (
              <Card key={stat.label} className="p-4 bg-bg-elevated border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                  <span className="text-xs text-text-muted">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-text-primary font-mono">{stat.value}</div>
              </Card>
            ))}
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-6">
            <Card className="p-5 bg-bg-elevated border border-border">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Finding Funnel</h2>
              <div className="space-y-3">
                {[
                  { label: "Total Discovered", count: 189, pct: 100 },
                  { label: "Validated", count: 47, pct: 25 },
                  { label: "Submitted", count: 12, pct: 6 },
                  { label: "Accepted", count: 8, pct: 4 },
                  { label: "Bounty Paid", count: 5, pct: 3 },
                ].map((stage) => (
                  <div key={stage.label} className="flex items-center gap-4">
                    <span className="w-32 text-xs text-text-secondary">{stage.label}</span>
                    <div className="flex-1 h-3 bg-bg-subtle rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${stage.pct}%` }} />
                    </div>
                    <span className="w-16 text-right text-xs font-mono text-text-primary">{stage.count}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 bg-bg-elevated border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Top Unsubmitted Findings</h2>
                <Link href="/findings" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View All Findings <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2.5">
                {[
                  { id: "1", title: "SSRF in api.uber.com/internal/health", severity: "critical", hunter: "hunter1" },
                  { id: "2", title: "SQLi in /rides/search?q=", severity: "high", hunter: "hunter2" },
                  { id: "3", title: "Reflected XSS in /profile/search", severity: "medium", hunter: "hunter1" },
                  { id: "4", title: "IDOR in user profile API", severity: "high", hunter: "hunter3" },
                ].map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-bg-subtle hover:bg-bg-overlay transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${
                        f.severity === "critical" ? "bg-critical" :
                        f.severity === "high" ? "bg-high" : "bg-medium"
                      }`} />
                      <Link href={`/findings/${f.id}`} className="text-xs font-semibold text-text-primary hover:text-primary transition-colors">
                        {f.title}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-text-muted">@{f.hunter}</span>
                      <Link href={`/findings/${f.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">Inspect</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-4">
            <Card className="p-5 bg-bg-elevated border border-border">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {[
                  { icon: Activity, text: "nuclei scan completed on Uber", time: "5m ago", color: "text-accent" },
                  { icon: Bug, text: "Critical finding discovered in Uber", time: "15m ago", color: "text-critical" },
                  { icon: Globe, text: "Airbnb program added to project", time: "1h ago", color: "text-primary" },
                  { icon: TrendingUp, text: "Bounty received: $500 — XSS", time: "3h ago", color: "text-accent" },
                  { icon: Users, text: "hunter3 joined the project", time: "1d ago", color: "text-text-muted" },
                ].map((event, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <event.icon className={`w-4 h-4 mt-0.5 ${event.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-text-secondary text-xs">{event.text}</p>
                      <p className="text-text-muted text-[10px] mt-0.5">{event.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 bg-bg-elevated border border-border">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Quick Actions</h2>
              <div className="space-y-2">
                <Button className="w-full justify-start text-xs" variant="ghost" size="sm" onClick={() => setActiveTab("programs")}>
                  <Globe className="w-3.5 h-3.5 mr-2 text-primary" /> View Programs ({programsList.length})
                </Button>
                <Button className="w-full justify-start text-xs" variant="ghost" size="sm" onClick={() => setActiveTab("kanban")}>
                  <FolderKanban className="w-3.5 h-3.5 mr-2 text-accent" /> Open Kanban Board
                </Button>
                <Button className="w-full justify-start text-xs" variant="ghost" size="sm" onClick={() => setIsAddProgramOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-2 text-medium" /> Add New Program
                </Button>
                <Button className="w-full justify-start text-xs" variant="ghost" size="sm" onClick={() => setIsAddMemberOpen(true)}>
                  <Users className="w-3.5 h-3.5 mr-2 text-low" /> Assign Hunter
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: PROGRAMS */}
      {activeTab === "programs" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">
              Programs in this Project <span className="text-sm font-normal text-text-muted">({programsList.length})</span>
            </h2>
            <Button onClick={() => setIsAddProgramOpen(true)} className="btn-primary flex items-center gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add Program
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {programsList.map((program) => (
              <Link key={program.id} href={`/programs/${program.id}`}>
                <Card className="p-5 bg-bg-elevated border border-border hover:border-primary/50 transition-all duration-150 cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-text-primary text-base">{program.name}</h3>
                      <span className="badge bg-primary-muted text-primary text-xs mt-1 inline-block">{program.platform}</span>
                    </div>
                    <span className="badge bg-accent-muted text-accent text-xs capitalize">{program.status}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-muted pt-3 border-t border-border">
                    <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-text-secondary" /> {program.targets} targets</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-text-secondary" /> {program.lastScan}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: KANBAN */}
      {activeTab === "kanban" && (
        <div className="animate-in fade-in duration-150">
          <KanbanBoard projectId={projectId} />
        </div>
      )}

      {/* TAB 4: NOTES */}
      {activeTab === "notes" && (
        <div className="animate-in fade-in duration-150">
          <ProjectNotes notes={notesList} onSave={handleSaveNote} onDelete={handleDeleteNote} />
        </div>
      )}

      {/* TAB 5: TIMELINE */}
      {activeTab === "timeline" && (
        <div className="animate-in fade-in duration-150">
          <ProjectTimeline events={timelineEvents} onRefresh={() => toast({ title: "Timeline refreshed", description: "Loaded latest engagement events." })} />
        </div>
      )}

      {/* TAB 6: TEAM */}
      {activeTab === "team" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Project Hunters</h2>
              <p className="text-xs text-text-muted mt-0.5">Assigned researchers and admins working this engagement</p>
            </div>
            <Button onClick={() => setIsAddMemberOpen(true)} className="btn-primary flex items-center gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" /> Assign Hunter
            </Button>
          </div>

          <Card className="bg-bg-elevated border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-subtle text-text-muted uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Hunter</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">2FA Status</th>
                  <th className="px-4 py-3 text-left">Last Active</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teamMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-bg-overlay transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-primary text-xs">{member.displayName}</div>
                      <div className="font-mono text-[11px] text-text-muted">@{member.username}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge bg-primary-muted text-primary text-xs capitalize">{member.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      {member.twoFactor ? (
                        <span className="flex items-center gap-1.5 text-xs text-accent">
                          <CheckCircle2 className="w-4 h-4" /> Enabled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-text-muted">
                          <XCircle className="w-4 h-4" /> Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">{member.lastLogin}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-critical hover:bg-critical/10"
                        onClick={() => {
                          setTeamMembers((prev) => prev.filter((m) => m.id !== member.id))
                          toast({ title: "Hunter removed", description: `${member.displayName} removed from project.` })
                        }}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Edit Project Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-bg-elevated shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-text-primary text-base">Edit Project Details</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary">Project Name</label>
                <Input value={projectData.name} onChange={(e) => setProjectData({ ...projectData, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary">Description</label>
                <Input value={projectData.description} onChange={(e) => setProjectData({ ...projectData, description: e.target.value })} className="mt-1" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                <Button className="btn-primary" onClick={() => { setIsEditModalOpen(false); toast({ title: "Project updated", description: "Details saved." }) }}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Program Modal */}
      {isAddProgramOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-bg-elevated shadow-2xl p-6">
            <ProgramForm onSubmit={handleAddProgramSubmit} onCancel={() => setIsAddProgramOpen(false)} />
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-bg-elevated shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-text-primary text-base">Assign Hunter to Project</h3>
              <button onClick={() => setIsAddMemberOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary">Hunter Name / Handle</label>
                <Input
                  required
                  placeholder="e.g. David Miller or @dmiller"
                  value={newMemberUsername}
                  onChange={(e) => setNewMemberUsername(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsAddMemberOpen(false)}>Cancel</Button>
                <Button type="submit" className="btn-primary">Assign Hunter</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

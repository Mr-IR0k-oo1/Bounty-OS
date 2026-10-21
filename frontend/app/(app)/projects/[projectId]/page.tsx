"use client"

import { useState, useEffect, useCallback } from "react"
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
  RefreshCw
} from "lucide-react"
import { KanbanBoard } from "@/components/projects/KanbanBoard"
import { ProjectNotes } from "@/components/projects/ProjectNotes"
import { ProjectTimeline } from "@/components/projects/ProjectTimeline"
import { ProgramForm } from "@/components/programs/ProgramForm"
import { useToast } from "@/hooks/useToast"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import type { Project, Program, Finding, Hunter } from "@/lib/types"

export default function ProjectOverviewPage() {
  const params = useParams()
  const rawId = (params.projectId as string) || ""
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"overview" | "programs" | "kanban" | "notes" | "timeline" | "team">("overview")

  const [loading, setLoading] = useState(true)
  const [resolvedProjectId, setResolvedProjectId] = useState<string>(rawId)
  const [projectData, setProjectData] = useState<{
    id: string
    name: string
    status: string
    description: string
  }>({
    id: rawId,
    name: "Loading Project...",
    status: "Active",
    description: "",
  })

  const [programsList, setProgramsList] = useState<Program[]>([])
  const [findingsList, setFindingsList] = useState<Finding[]>([])
  const [teamMembers, setTeamMembers] = useState<Hunter[]>([])

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [newMemberUsername, setNewMemberUsername] = useState("")

  // Notes state
  const [notesList, setNotesList] = useState<any[]>([])

  const loadProjectDetails = useCallback(async () => {
    setLoading(true)
    try {
      let pId = rawId
      // If given numeric id or non-uuid, resolve to first real project in DB
      let p: Project | null = null
      if (rawId && rawId.includes("-")) {
        try {
          p = await api.getProject(rawId)
        } catch {
          p = null
        }
      }

      if (!p) {
        const allProjects = await api.listProjects()
        if (allProjects && allProjects.length > 0) {
          p = allProjects[0]
          pId = p.id
        }
      }

      if (p) {
        setResolvedProjectId(p.id)
        const isActive = p.active !== undefined ? p.active : p.status !== "archived"
        setProjectData({
          id: p.id,
          name: p.name,
          status: isActive ? "Active" : "Archived",
          description: p.description || "Bug bounty engagement workspace.",
        })

        const [progs, finds, hunters] = await Promise.all([
          api.listPrograms(p.id).catch(() => []),
          api.listProjectFindings(p.id).catch(() => []),
          api.listHunters().catch(() => []),
        ])

        setProgramsList(progs || [])
        setFindingsList(finds || [])
        setTeamMembers(hunters || [])
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to load project", description: e.message })
    } finally {
      setLoading(false)
    }
  }, [rawId, toast])

  useEffect(() => {
    loadProjectDetails()
  }, [loadProjectDetails])

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
      projectId: resolvedProjectId,
      title: note.title || "Untitled Note",
      content: note.content || "",
      tags: note.tags || ["general"],
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
    toast({ title: "Note saved", description: `"${updated.title}" saved successfully.` })
  }

  const handleDeleteNote = async (id: string) => {
    setNotesList((prev) => prev.filter((n) => n.id !== id))
    toast({ title: "Note deleted" })
  }

  const handleAddProgramSubmit = async (data: any) => {
    try {
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const created = await api.createProgram(resolvedProjectId, {
        name: data.name,
        slug: slug || "program",
        platform: data.platform || "other",
        programUrl: data.programUrl || null,
        bountyRangeLow: data.bountyRangeLow ?? null,
        bountyRangeHigh: data.bountyRangeHigh ?? null,
        notes: data.notes || null,
      })
      setProgramsList((prev) => [...prev, created])
      setIsAddProgramOpen(false)
      toast({ title: "Program added", description: `${created.name} enrolled into project.` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to add program", description: e.message })
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberUsername.trim()) return
    try {
      const created = await api.createHunter({
        username: newMemberUsername.toLowerCase().replace(/\s+/g, ""),
        display_name: newMemberUsername.trim(),
        role: "hunter",
      })
      setTeamMembers((prev) => [...prev, created])
      setNewMemberUsername("")
      setIsAddMemberOpen(false)
      toast({ title: "Hunter assigned", description: `${created.displayName} joined this project.` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Assignment failed", description: e.message })
    }
  }

  const totalFindingsCount = findingsList.length
  const submittedCount = findingsList.filter(f => f.status === "submitted" || f.status === "bounty_awarded").length
  const validatedCount = findingsList.filter(f => f.status === "validated").length

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
          <p className="text-xs text-text-muted mt-1">{projectData.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadProjectDetails()} className="gap-1.5 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} /> Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsEditModalOpen(true)}>Edit</Button>
          <Button
            size="sm"
            className="btn-primary"
            onClick={async () => {
              const newActive = projectData.status !== "Active"
              try {
                await api.updateProject(resolvedProjectId, { active: newActive })
                setProjectData((prev) => ({ ...prev, status: newActive ? "Active" : "Archived" }))
                toast({ title: "Status updated", description: `Project is now ${newActive ? "Active" : "Archived"}.` })
              } catch (e: any) {
                toast({ variant: "destructive", title: "Update failed", description: e.message })
              }
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
              { label: "Total Findings", value: String(totalFindingsCount), icon: Bug, color: "text-critical" },
              { label: "Hunters", value: String(teamMembers.length), icon: Users, color: "text-accent" },
              { label: "Validated", value: String(validatedCount), icon: Shield, color: "text-low" },
              { label: "Submitted", value: String(submittedCount), icon: FileText, color: "text-medium" },
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
                  { label: "Total Discovered", count: totalFindingsCount, pct: 100 },
                  { label: "Validated", count: validatedCount, pct: totalFindingsCount > 0 ? Math.round((validatedCount / totalFindingsCount) * 100) : 0 },
                  { label: "Submitted", count: submittedCount, pct: totalFindingsCount > 0 ? Math.round((submittedCount / totalFindingsCount) * 100) : 0 },
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
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Project Findings</h2>
                <Link href="/findings" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View All Findings <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2.5">
                {findingsList.slice(0, 5).map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-bg-subtle hover:bg-bg-overlay transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${
                        f.severity === "critical" ? "bg-critical" :
                        f.severity === "high" ? "bg-high" : "bg-medium"
                      }`} />
                      <span className="text-xs font-semibold text-text-primary">
                        {f.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-text-muted">
                        {f.matched_at || f.status}
                      </span>
                    </div>
                  </div>
                ))}
                {findingsList.length === 0 && (
                  <div className="text-xs text-text-muted py-6 text-center">No findings recorded in this project yet.</div>
                )}
              </div>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-4">
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
                      <span className="badge bg-primary-muted text-primary text-xs mt-1 inline-block capitalize">{program.platform}</span>
                    </div>
                    <span className="badge bg-accent-muted text-accent text-xs capitalize">
                      {program.active !== false ? "active" : "archived"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-muted pt-3 border-t border-border">
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-text-secondary" /> {program.targets ?? (program.stats?.subdomainCount || 0)} targets
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-text-secondary" /> {program.lastScan || (program.lastScannedAt ? "Scanned" : "Ready")}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
            {programsList.length === 0 && (
              <div className="col-span-full p-8 text-center text-xs text-text-muted border border-dashed rounded-xl">
                No programs in this project. Click Add Program to enroll a target.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: KANBAN */}
      {activeTab === "kanban" && (
        <div className="animate-in fade-in duration-150">
          <KanbanBoard projectId={resolvedProjectId} />
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
          <ProjectTimeline
            events={findingsList.map(f => ({
              id: f.id,
              type: "finding",
              message: `${f.title} (${f.severity})`,
              timestamp: f.created_at || (f as any).foundAt || new Date().toISOString(),
              programName: projectData.name,
              severity: f.severity,
            }))}
            onRefresh={() => loadProjectDetails()}
          />
        </div>
      )}

      {/* TAB 6: TEAM */}
      {activeTab === "team" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Project Hunters</h2>
              <p className="text-xs text-text-muted mt-0.5">Assigned researchers and operators</p>
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
                      {member.totpEnabled ? (
                        <span className="flex items-center gap-1.5 text-xs text-accent">
                          <CheckCircle2 className="w-4 h-4" /> Enabled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-text-muted">
                          <XCircle className="w-4 h-4" /> Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : "Active"}
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
                <Button className="btn-primary" onClick={async () => {
                  try {
                    await api.updateProject(resolvedProjectId, { name: projectData.name, description: projectData.description })
                    setIsEditModalOpen(false)
                    toast({ title: "Project updated", description: "Details saved." })
                  } catch (e: any) {
                    toast({ variant: "destructive", title: "Update failed", description: e.message })
                  }
                }}>
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
                  placeholder="e.g. David Miller"
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

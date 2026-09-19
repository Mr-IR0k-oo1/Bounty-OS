"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, FolderKanban, ArrowUpRight, MoreHorizontal, Users, Bug, Shield, X, Calendar as CalendarIcon, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/useToast"

interface Project {
  id: string
  name: string
  description: string
  status: "active" | "archived"
  programs: number
  findings: { c: number; h: number; m: number; l: number }
  newFindings: number
  triaged: number
  validated: number
  submitted: number
  hunters: number
  startDate: string
  endDate: string | null
}

const initialProjects: Project[] = [
  { id: "1", name: "H1 Private Programs — Q1 2025", description: "Top-tier private invite-only programs on HackerOne", status: "active", programs: 4, findings: { c: 3, h: 8, m: 12, l: 5 }, newFindings: 6, triaged: 10, validated: 7, submitted: 5, hunters: 3, startDate: "2025-01-01", endDate: "2025-03-31" },
  { id: "2", name: "Client Pentest — Acme Corp", description: "Quarterly penetration test for Acme Corp infrastructure", status: "active", programs: 1, findings: { c: 0, h: 2, m: 5, l: 8 }, newFindings: 2, triaged: 5, validated: 5, submitted: 3, hunters: 2, startDate: "2025-02-15", endDate: null },
  { id: "3", name: "Personal Continuous Bug Bounty", description: "Ongoing personal bug bounty hunting across public programs", status: "active", programs: 12, findings: { c: 1, h: 4, m: 15, l: 10 }, newFindings: 8, triaged: 12, validated: 6, submitted: 4, hunters: 1, startDate: "2024-06-01", endDate: null },
  { id: "4", name: "Synack Red Team — March", description: "Synack red team engagements for March 2025", status: "active", programs: 2, findings: { c: 2, h: 3, m: 4, l: 2 }, newFindings: 3, triaged: 4, validated: 2, submitted: 2, hunters: 4, startDate: "2025-03-01", endDate: "2025-03-31" },
  { id: "5", name: "Archive — 2024 Programs", description: "Archived programs from 2024", status: "archived", programs: 8, findings: { c: 0, h: 0, m: 0, l: 0 }, newFindings: 0, triaged: 8, validated: 8, submitted: 8, hunters: 2, startDate: "2024-01-01", endDate: "2024-12-31" },
]

const statusFilters = ["All", "Active", "Archived"]

export default function ProjectsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [projectsList, setProjectsList] = useState<Project[]>(initialProjects)
  const [filter, setFilter] = useState("All")
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split("T")[0])
  const [formEndDate, setFormEndDate] = useState("")

  const filtered = projectsList.filter((p) => filter === "All" || p.status === filter.toLowerCase())

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return

    const newProject: Project = {
      id: String(Date.now()),
      name: formName,
      description: formDescription || "Bug bounty engagement container",
      status: "active",
      programs: 0,
      findings: { c: 0, h: 0, m: 0, l: 0 },
      newFindings: 0,
      triaged: 0,
      validated: 0,
      submitted: 0,
      hunters: 1,
      startDate: formStartDate,
      endDate: formEndDate || null,
    }

    setProjectsList([newProject, ...projectsList])
    setIsNewModalOpen(false)
    setFormName("")
    setFormDescription("")
    setFormEndDate("")
    toast({
      title: "Project created",
      description: `${newProject.name} has been added successfully.`,
    })
  }

  const toggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setProjectsList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: p.status === "active" ? "archived" : "active" } : p))
    )
    setActiveDropdown(null)
    toast({
      title: "Project updated",
      description: "Project status changed.",
    })
  }

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setProjectsList((prev) => prev.filter((p) => p.id !== id))
    setActiveDropdown(null)
    toast({
      title: "Project deleted",
      description: "Project has been removed.",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2.5">
            <FolderKanban className="w-6 h-6 text-primary" /> Projects
          </h1>
          <p className="text-sm text-text-muted mt-0.5">{filtered.length} active engagements and scopes</p>
        </div>
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-primary rounded-xl text-white text-xs font-semibold hover:bg-primary-hover transition-fast shadow-glow-primary"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl bg-bg-base border border-border w-fit">
        {statusFilters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
              filter === f ? "bg-bg-elevated text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((project) => {
          const totalFindings = project.findings.c + project.findings.h + project.findings.m + project.findings.l
          return (
            <div key={project.id} className="relative group">
              <Link href={`/projects/${project.id}`} className="block">
                <div className="finding-stat-card hover:border-primary/50 transition-all duration-200 cursor-pointer h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-primary-muted flex items-center justify-center shrink-0">
                          <FolderKanban className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-text-primary group-hover:text-primary transition-fast">
                            {project.name}
                          </div>
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mt-1 capitalize",
                              project.status === "active" ? "bg-low-muted text-low border border-low/20" : "bg-bg-subtle text-text-muted border border-border"
                            )}
                          >
                            {project.status}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setActiveDropdown(activeDropdown === project.id ? null : project.id)
                        }}
                        className="p-1.5 rounded-lg hover:bg-bg-overlay text-text-muted hover:text-text-primary transition-fast"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-text-secondary line-clamp-2 mb-4 leading-relaxed">
                      {project.description}
                    </p>

                    <div className="flex items-center gap-4 mb-4 text-xs">
                      <div className="flex items-center gap-1.5 text-text-secondary font-medium">
                        <Shield className="w-3.5 h-3.5 text-primary" />
                        {project.programs} programs
                      </div>
                      <div className="flex items-center gap-1.5 text-text-secondary font-medium">
                        <Bug className="w-3.5 h-3.5 text-accent" />
                        {totalFindings} findings
                      </div>
                      <div className="flex items-center gap-1.5 text-text-secondary font-medium">
                        <Users className="w-3.5 h-3.5 text-text-muted" />
                        {project.hunters} hunters
                      </div>
                    </div>

                    {totalFindings > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-1 h-1.5 overflow-hidden rounded-full bg-bg-subtle">
                          <div className="h-full bg-critical transition-all" style={{ width: `${(project.findings.c / totalFindings) * 100}%` }} />
                          <div className="h-full bg-high transition-all" style={{ width: `${(project.findings.h / totalFindings) * 100}%` }} />
                          <div className="h-full bg-medium transition-all" style={{ width: `${(project.findings.m / totalFindings) * 100}%` }} />
                          <div className="h-full bg-low transition-all" style={{ width: `${(project.findings.l / totalFindings) * 100}%` }} />
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono">
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-critical" />{project.findings.c} crit</span>
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-high" />{project.findings.h} high</span>
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-medium" />{project.findings.m} med</span>
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-low" />{project.findings.l} low</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[10px] text-text-muted">
                      <span className="px-2 py-0.5 rounded bg-bg-subtle border border-border">New: {project.newFindings}</span>
                      <span className="px-2 py-0.5 rounded bg-bg-subtle border border-border">Triaged: {project.triaged}</span>
                      <span className="px-2 py-0.5 rounded bg-bg-subtle border border-border">Validated: {project.validated}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-[11px] text-text-subtle font-mono">
                      {project.startDate}{project.endDate ? ` → ${project.endDate}` : " → Active"}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                      Open Project <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>

              {/* Dropdown Menu */}
              {activeDropdown === project.id && (
                <div
                  className="absolute right-3 top-12 w-44 rounded-xl border border-border bg-bg-elevated shadow-2xl py-1 z-30 animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => toggleStatus(project.id, e)}
                    className="w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-fast"
                  >
                    {project.status === "active" ? "Archive Project" : "Unarchive Project"}
                  </button>
                  <button
                    onClick={(e) => deleteProject(project.id, e)}
                    className="w-full px-3 py-2 text-left text-xs text-critical hover:bg-critical/10 transition-fast"
                  >
                    Delete Project
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* New Project Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-bg-elevated shadow-2xl overflow-hidden p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <FolderKanban className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-text-primary">Create New Project</h2>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-fast"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4 mt-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Project Name *</label>
                <Input
                  required
                  placeholder="e.g. Q2 2025 Bug Bounty Portfolio"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Description</label>
                <Textarea
                  placeholder="Goals, client details, rules of engagement notes..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Start Date</label>
                  <Input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">End Date (optional)</label>
                  <Input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setIsNewModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-primary">
                  Create Project
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

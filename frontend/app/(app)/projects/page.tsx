"use client"

import { useState } from "react"
import { Plus, FolderKanban, ArrowUpRight, MoreHorizontal, Users, Bug, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

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

const projects: Project[] = [
  { id: "1", name: "H1 Private Programs — Q1 2025", description: "Top-tier private invite-only programs on HackerOne", status: "active", programs: 4, findings: { c: 3, h: 8, m: 12, l: 5 }, newFindings: 6, triaged: 10, validated: 7, submitted: 5, hunters: 3, startDate: "2025-01-01", endDate: "2025-03-31" },
  { id: "2", name: "Client Pentest — Acme Corp", description: "Quarterly penetration test for Acme Corp infrastructure", status: "active", programs: 1, findings: { c: 0, h: 2, m: 5, l: 8 }, newFindings: 2, triaged: 5, validated: 5, submitted: 3, hunters: 2, startDate: "2025-02-15", endDate: null },
  { id: "3", name: "Personal Continuous Bug Bounty", description: "Ongoing personal bug bounty hunting across public programs", status: "active", programs: 12, findings: { c: 1, h: 4, m: 15, l: 10 }, newFindings: 8, triaged: 12, validated: 6, submitted: 4, hunters: 1, startDate: "2024-06-01", endDate: null },
  { id: "4", name: "Synack Red Team — March", description: "Synack red team engagements for March 2025", status: "active", programs: 2, findings: { c: 2, h: 3, m: 4, l: 2 }, newFindings: 3, triaged: 4, validated: 2, submitted: 2, hunters: 4, startDate: "2025-03-01", endDate: "2025-03-31" },
  { id: "5", name: "Archive — 2024 Programs", description: "Archived programs from 2024", status: "archived", programs: 8, findings: { c: 0, h: 0, m: 0, l: 0 }, newFindings: 0, triaged: 8, validated: 8, submitted: 8, hunters: 2, startDate: "2024-01-01", endDate: "2024-12-31" },
]

const statusFilters = ["All", "Active", "Archived"]

export default function ProjectsPage() {
  const [filter, setFilter] = useState("All")
  const filtered = projects.filter(p => filter === "All" || p.status === filter.toLowerCase())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Projects</h1>
          <p className="text-sm text-text-muted mt-0.5">{filtered.length} projects</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary rounded-lg text-white text-xs font-medium hover:bg-primary-hover transition-fast shadow-glow-primary">
          <Plus className="w-3.5 h-3.5" /> New Project
        </button>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-base border border-border w-fit">
        {statusFilters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
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
            <div key={project.id} className="group finding-stat-card cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary-muted flex items-center justify-center shrink-0">
                    <FolderKanban className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text-primary group-hover:text-primary transition-fast">
                      {project.name}
                    </div>
                    <span className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5",
                      project.status === "active" ? "bg-low-muted text-low" : "bg-info-muted text-info"
                    )}>
                      {project.status}
                    </span>
                  </div>
                </div>
                <button className="p-1 rounded hover:bg-bg-overlay opacity-0 group-hover:opacity-100 transition-fast">
                  <MoreHorizontal className="w-4 h-4 text-text-muted" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-3 text-xs">
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Shield className="w-3.5 h-3.5 text-text-muted" />
                  {project.programs} programs
                </div>
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Bug className="w-3.5 h-3.5 text-text-muted" />
                  {totalFindings} findings
                </div>
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Users className="w-3.5 h-3.5 text-text-muted" />
                  {project.hunters} hunters
                </div>
              </div>

              {totalFindings > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1 h-1.5">
                    <div className="h-full rounded-l-full bg-critical transition-all" style={{ width: `${(project.findings.c / totalFindings) * 100}%` }} />
                    <div className="h-full bg-high transition-all" style={{ width: `${(project.findings.h / totalFindings) * 100}%` }} />
                    <div className="h-full bg-medium transition-all" style={{ width: `${(project.findings.m / totalFindings) * 100}%` }} />
                    <div className="h-full rounded-r-full bg-low transition-all" style={{ width: `${(project.findings.l / totalFindings) * 100}%` }} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-critical" />{project.findings.c}</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-high" />{project.findings.h}</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-medium" />{project.findings.m}</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-low" />{project.findings.l}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 text-[10px] text-text-muted">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded bg-primary-muted" /> New: {project.newFindings}</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded bg-medium-muted" /> Triaged: {project.triaged}</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded bg-low-muted" /> Validated: {project.validated}</span>
              </div>

              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-[10px] text-text-subtle">
                  {project.startDate}{project.endDate ? ` — ${project.endDate}` : " — Ongoing"}
                </span>
                <span className="flex items-center gap-0.5 text-xs text-primary opacity-0 group-hover:opacity-100 transition-fast">
                  View <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

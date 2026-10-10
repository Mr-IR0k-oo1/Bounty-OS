"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Globe, Clock, Target, Search, AlertCircle, RefreshCw } from "lucide-react"
import { ProgramForm } from "@/components/programs/ProgramForm"
import { usePrograms } from "@/hooks/usePrograms"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/useToast"
import { cn } from "@/lib/utils"

type Tab = "all" | "active" | "archived"

export default function ProgramsPage() {
  const { toast } = useToast()
  const { programs, loading, error, refetch } = usePrograms()
  const [activeTab, setActiveTab] = useState<Tab>("all")
  const [platformFilter, setPlatformFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)

  const filtered = programs
    .filter((p) => {
      const status = p.active ? "active" : "archived"
      return activeTab === "all" || status === activeTab
    })
    .filter((p) => {
      if (platformFilter === "all") return true
      const plat = (p.platform || "").toLowerCase()
      const filter = platformFilter.toLowerCase()
      if (filter === "hackerone" && plat === "h1") return true
      return plat.includes(filter) || filter.includes(plat)
    })
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  const handleCreateProgram = async (data: any) => {
    try {
      let targetProjectId = data.projectId || data.project_id
      if (!targetProjectId) {
        const projects = await api.listProjects()
        if (projects.length > 0) {
          targetProjectId = projects[0].id
        } else {
          throw new Error("No projects available. Please create a project first.")
        }
      }
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const created = await api.createProgram(targetProjectId, {
        name: data.name,
        slug: slug || "program",
        platform: data.platform || "other",
        programUrl: data.programUrl || null,
        bountyRangeLow: data.bountyRangeLow ?? null,
        bountyRangeHigh: data.bountyRangeHigh ?? null,
        notes: data.notes || null,
      })
      await refetch()
      setShowAddModal(false)
      toast({
        title: "Program registered",
        description: `${created.name} has been enrolled in Bounty-OS.`,
      })
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: e.message || "Could not register program",
      })
    }
  }

  const formatPlatform = (p: string) => {
    switch (p.toLowerCase()) {
      case "h1":
        return "HackerOne"
      case "bugcrowd":
        return "Bugcrowd"
      case "intigriti":
        return "Intigriti"
      case "synack":
        return "Synack"
      default:
        return p || "Other"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2.5">
            <Target className="w-6 h-6 text-primary" /> Target Programs
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {filtered.length} targets configured for asset enumeration and vulnerability checks
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 text-xs">
          <Plus className="w-4 h-4" /> New Program
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-severity-critical/30 bg-severity-critical/10 flex items-center justify-between gap-3 text-sm text-text-primary">
          <div className="flex items-center gap-2 text-severity-critical">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Failed to load programs: {error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <Input
            placeholder="Search programs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 p-1 bg-bg-subtle rounded-xl border border-border">
          {(["all", "active", "archived"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all duration-150",
                activeTab === tab
                  ? "bg-bg-elevated text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Platform Filter */}
        <div className="flex gap-1 p-1 bg-bg-subtle rounded-xl border border-border text-xs">
          {["all", "HackerOne", "Bugcrowd", "Intigriti"].map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150",
                platformFilter === p
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 bg-bg-elevated border border-border rounded-xl animate-pulse h-40 flex flex-col justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-bg-subtle" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-bg-subtle rounded w-2/3" />
                  <div className="h-3 bg-bg-subtle rounded w-1/3" />
                </div>
              </div>
              <div className="h-4 bg-bg-subtle rounded w-1/2 pt-4 border-t border-border" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <Card className="p-12 text-center bg-bg-elevated border border-border">
          <Target className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-semibold text-text-primary">No target programs found</h3>
          <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
            {search || platformFilter !== "all" || activeTab !== "all"
              ? "No programs matched your current filter criteria."
              : "No programs configured yet. Click 'New Program' to enroll your first target."}
          </p>
          <div className="mt-4">
            <Button onClick={() => setShowAddModal(true)} className="btn-primary text-xs">
              <Plus className="w-4 h-4 mr-1.5" /> New Program
            </Button>
          </div>
        </Card>
      )}

      {/* Programs grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((program) => (
            <Link key={program.id} href={`/programs/${program.id}`}>
              <Card className="p-5 bg-bg-elevated border border-border hover:border-primary/50 transition-all duration-200 cursor-pointer group h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-bg-subtle flex items-center justify-center font-bold text-lg text-primary group-hover:scale-105 transition-transform">
                        {program.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-text-primary text-base group-hover:text-primary transition-colors">
                          {program.name}
                        </h3>
                        <span className="badge bg-primary-muted text-primary text-[11px] mt-0.5 inline-block">
                          {formatPlatform(program.platform)}
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "badge text-xs capitalize",
                        program.active !== false ? "bg-accent-muted text-accent" : "bg-bg-subtle text-text-muted"
                      )}
                    >
                      {program.active !== false ? "active" : "archived"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-text-muted pt-4 border-t border-border mt-3">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Globe className="w-3.5 h-3.5 text-text-secondary" /> {program.targets ?? (program.stats?.subdomainCount || 0)} targets
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-text-secondary" /> {program.lastScan || (program.lastScannedAt ? "Scanned" : "Not scanned")}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-border bg-bg-elevated shadow-2xl p-6 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <ProgramForm onSubmit={handleCreateProgram} onCancel={() => setShowAddModal(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

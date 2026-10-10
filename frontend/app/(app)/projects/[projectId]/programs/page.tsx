"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Globe, Clock, AlertCircle, RefreshCw, Target } from "lucide-react"
import Link from "next/link"
import { ProgramForm } from "@/components/programs/ProgramForm"
import { usePrograms } from "@/hooks/usePrograms"
import { useToast } from "@/hooks/useToast"
import { cn } from "@/lib/utils"

export default function ProjectProgramsPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const { toast } = useToast()
  const { programs, loading, error, refetch, createProgram } = usePrograms(projectId)
  const [showAdd, setShowAdd] = useState(false)

  const handleAddSubmit = async (data: any) => {
    try {
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const created = await createProgram({
        name: data.name,
        slug: slug || "program",
        platform: data.platform || "other",
        programUrl: data.programUrl || null,
        bountyRangeLow: data.bountyRangeLow ?? null,
        bountyRangeHigh: data.bountyRangeHigh ?? null,
        notes: data.notes || null,
      })
      setShowAdd(false)
      toast({
        title: "Program registered",
        description: `${created.name} added to this project.`,
      })
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: e.message || "Failed to create program",
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
      <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
        <Link href={`/projects/${projectId}`} className="hover:text-text-primary">Project</Link>
        <span>/</span>
        <span className="text-text-primary">Programs</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">
          Programs <span className="text-sm font-normal text-text-muted">({programs.length} in this project)</span>
        </h1>
        <Button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-xs">
          <Plus className="w-4 h-4" />
          Add Program
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-severity-critical/30 bg-severity-critical/10 flex items-center justify-between gap-3 text-sm text-text-primary">
          <div className="flex items-center gap-2 text-severity-critical">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Failed to load project programs: {error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs text-text-primary">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 bg-bg-elevated border border-border rounded-xl animate-pulse h-36" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && programs.length === 0 && (
        <Card className="p-12 text-center bg-bg-elevated border border-border">
          <Target className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-semibold text-text-primary">No programs enrolled in this project</h3>
          <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
            Click &apos;Add Program&apos; above to enroll a target into this project.
          </p>
        </Card>
      )}

      {/* Programs grid */}
      {!loading && !error && programs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((program) => (
            <Link key={program.id} href={`/programs/${program.id}`}>
              <Card className="p-5 bg-bg-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer h-full flex flex-col justify-between">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-text-primary">{program.name}</h3>
                    <span className="badge bg-primary-muted text-primary text-xs mt-1 inline-block">
                      {formatPlatform(program.platform)}
                    </span>
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
                <div className="flex items-center gap-4 text-xs text-text-muted border-t border-border pt-3">
                  <span className="flex items-center gap-1 font-medium">
                    <Globe className="w-3.5 h-3.5 text-text-secondary" /> {program.targets ?? (program.stats?.subdomainCount || 0)} targets
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-text-secondary" /> {program.lastScan || (program.lastScannedAt ? "Scanned" : "Not scanned")}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-bg-elevated shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <ProgramForm onSubmit={handleAddSubmit} onCancel={() => setShowAdd(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { BarChart, Users, Calendar, DollarSign, Activity, Shield, Target, Cpu } from "lucide-react"

export function ProjectOverview({
  project,
}: {
  project: {
    id: string
    name: string
    status: string
    progress: number
    programs: number
    findings: number
    bounty: number
    lead: string
    team: string[]
    startDate: string
    endDate: string
  }
}) {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 border-l-4 border-primary pl-6 py-2">
        <div className="flex items-center gap-3 text-[10px] font-mono tracking-[0.2em] text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3" />
            NODE_ACTIVE
          </span>
          <span>/</span>
          <span>{project.id.toUpperCase()}</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">{project.name}</h1>
          <Badge className="rounded-none px-4 py-1 text-[11px] font-bold uppercase tracking-widest bg-primary text-primary-foreground">
            {project.status}
          </Badge>
        </div>
        <div className="flex items-center gap-6 text-[11px] font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="opacity-50">LEAD:</span>
            <span className="text-foreground font-bold">{project.lead.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-50">UNIT:</span>
            <span className="text-foreground font-bold">{project.team.join(", ").toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "VULNS_FOUND", value: project.findings.toString().padStart(2, '0'), icon: Shield, color: "text-red-500" },
          { label: "TARGETS_SCANNED", value: project.programs.toString().padStart(2, '0'), icon: Target, color: "text-blue-500" },
          { label: "TOTAL_BOUNTY", value: `$${project.bounty.toLocaleString()}`, icon: DollarSign, color: "text-green-500" },
          { label: "COMPLETION_RATE", value: `${project.progress}%`, icon: Activity, color: "text-primary" },
        ].map((stat, i) => (
          <div key={i} className="technical-surface p-6 border-b-2 border-b-primary/10 hover:border-b-primary transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground">{stat.label}</span>
              <stat.icon className={cn("w-4 h-4 opacity-50", stat.color)} />
            </div>
            <div className="text-3xl font-black tracking-tighter font-mono">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="technical-surface p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-16 h-16 opacity-5">
              <Grid3X3 className="w-full h-full" />
            </div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-bold tracking-widest uppercase">Operational Timeline</h3>
              <div className="flex gap-4 text-[10px] font-mono">
                <span className="text-muted-foreground">START: {project.startDate}</span>
                <span className="text-muted-foreground">EST_END: {project.endDate}</span>
              </div>
            </div>
            <div className="h-64 flex items-end gap-2 px-2">
              {[40, 60, 45, 90, 65, 30, 85, 40, 70, 50, 95, 60].map((h, i) => (
                <div key={i} className="flex-1 bg-primary/10 border-t-2 border-primary/40 hover:bg-primary/20 transition-all relative group" style={{ height: `${h}%` }}>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[9px] font-mono bg-primary text-primary-foreground px-1 py-0.5 transition-opacity">
                    {h}%
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-[9px] font-mono text-muted-foreground">
              <span>00:00 [EPOCH]</span>
              <span>23:59 [CURRENT]</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="technical-surface p-6">
            <h3 className="text-sm font-bold tracking-widest uppercase mb-6 flex items-center justify-between">
              Live Feed
              <span className="flex h-2 w-2 rounded-full bg-green-500" />
            </h3>
            <div className="space-y-6">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-start gap-4 group">
                  <div className="mt-1 h-2 w-2 bg-primary/40 group-hover:bg-primary transition-colors" />
                  <div className="flex-1 space-y-1">
                    <p className="text-[11px] font-bold leading-none uppercase tracking-tight">
                      Vulnerability Identified #{item * 124}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
                      Cross-site Scripting found in legacy API endpoint. Source: @HUNTER_0{item}
                    </p>
                    <p className="text-[9px] font-mono text-muted-foreground/40">{item * 10}m ago</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-6 rounded-none border border-dashed text-[10px] font-bold uppercase tracking-widest hover:bg-primary/5">
              Access Full Logs
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { cn } from "@/lib/utils"
import { Grid3X3 } from "lucide-react"

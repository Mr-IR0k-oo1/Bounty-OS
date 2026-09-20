"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Target, Shield, DollarSign } from "lucide-react"

export function ProjectCard({
  project,
}: {
  project: {
    id: string
    name: string
    slug: string
    status: string
    progress: number
    programs: number
    findings: number
    bounty: number
  }
}) {
  return (
    <Card className="rounded-none border-2 hover:border-primary transition-all technical-surface group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-12 h-12 opacity-5 pointer-events-none">
        <div className="absolute top-0 right-0 border-t-[12px] border-r-[12px] border-t-primary border-r-transparent rotate-180" />
      </div>
      
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <span className="text-[10px] font-mono font-bold text-muted-foreground/50 tracking-widest">PROJECT_{project.id}</span>
          <CardTitle className="text-xl font-black tracking-tighter uppercase italic group-hover:text-primary transition-colors">
            {project.name}
          </CardTitle>
        </div>
        <Badge className="rounded-none px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary border-primary/20">
          {project.status}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Target, value: project.programs, label: "TARGETS" },
            { icon: Shield, value: project.findings, label: "VULNS" },
            { icon: DollarSign, value: project.bounty, label: "REWARD" },
          ].map((stat, i) => (
            <div key={i} className="flex flex-col items-center p-2 bg-muted/30 border border-transparent hover:border-border transition-colors">
              <stat.icon className="w-3 h-3 text-muted-foreground mb-1" />
              <span className="text-sm font-bold font-mono leading-none">{stat.value}</span>
              <span className="text-[8px] font-bold text-muted-foreground tracking-tighter uppercase">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase tracking-tighter">
            <span className="text-muted-foreground">Operational_Progress</span>
            <span>{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-1 rounded-none bg-muted" />
        </div>

        <Link
          href={`/projects/${project.slug}`}
          className="flex w-full items-center justify-center border-2 border-primary bg-primary text-primary-foreground px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition-all hover:bg-transparent hover:text-primary"
        >
          Access Command Center
        </Link>
      </CardContent>
    </Card>
  )
}

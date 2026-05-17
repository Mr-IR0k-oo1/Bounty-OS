"use client"

import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function KanbanCard({
  finding,
}: {
  finding: {
    id: string
    title: string
    severity: string
    program: string
    assigned: string
    timestamp: string
  }
}) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-500 border-red-500/50"
      case "high":
        return "bg-orange-500/10 text-orange-500 border-orange-500/50"
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/50"
      case "low":
        return "bg-blue-500/10 text-blue-500 border-blue-500/50"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  return (
    <Card className="rounded-none border p-3 hover:border-primary transition-all bg-card/40 group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-8 h-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
        <div className="absolute top-0 right-0 border-t-8 border-r-8 border-t-primary border-r-transparent rotate-180" />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className={cn(
            "px-1.5 py-0.5 text-[9px] font-bold border font-mono tracking-tighter",
            getSeverityColor(finding.severity)
          )}>
            {finding.severity.toUpperCase()}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground/60">{finding.timestamp}</span>
        </div>
        
        <h4 className="text-[13px] font-bold leading-snug tracking-tight group-hover:text-primary transition-colors">
          {finding.title}
        </h4>
        
        <div className="pt-1 flex flex-wrap gap-x-3 gap-y-1 items-center text-[10px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
            {finding.program.toUpperCase()}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
            {finding.assigned.toUpperCase()}
          </span>
        </div>
      </div>
      
      <Link
        href={`/findings/${finding.id}`}
        className="absolute inset-0 z-10"
      >
        <span className="sr-only">View {finding.title}</span>
      </Link>
    </Card>
  )
}

import { cn } from "@/lib/utils"

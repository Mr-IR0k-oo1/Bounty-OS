"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Globe, Clock } from "lucide-react"
import Link from "next/link"

const programs = [
  { id: "1", name: "Uber", platform: "HackerOne", status: "active", targets: 142, lastScan: "2m ago" },
  { id: "2", name: "Airbnb", platform: "Bugcrowd", status: "active", targets: 89, lastScan: "15m ago" },
  { id: "3", name: "Twitter", platform: "HackerOne", status: "active", targets: 203, lastScan: "1h ago" },
]

export default function ProjectProgramsPage() {
  const params = useParams()
  const projectId = params.projectId as string

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
        <a href={`/projects/${projectId}`} className="hover:text-text-primary">Project</a>
        <span>/</span>
        <span className="text-text-primary">Programs</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">
          Programs <span className="text-sm font-normal text-text-muted">3 in this project</span>
        </h1>
        <Button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Program
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {programs.map((program) => (
          <Link key={program.id} href={`/programs/${program.id}`}>
            <Card className="p-5 bg-bg-elevated border border-border hover:border-primary/50 transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-text-primary">{program.name}</h3>
                  <span className="badge bg-primary-muted text-primary text-xs mt-1 inline-block">{program.platform}</span>
                </div>
                <span className="badge bg-accent-muted text-accent text-xs">{program.status}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {program.targets} targets</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {program.lastScan}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

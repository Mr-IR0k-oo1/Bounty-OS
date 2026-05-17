"use client"

import { useParams } from "next/navigation"
import { KanbanBoard } from "@/components/projects/KanbanBoard"

export default function ProjectKanbanPage() {
  const params = useParams()
  const projectId = params.projectId as string

  return (
    <div className="h-full">
      <KanbanBoard projectId={projectId} />
    </div>
  )
}

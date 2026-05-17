"use client"

import { useParams } from "next/navigation"
import { Timeline } from "@/components/projects/Timeline"

export default function ProjectTimelinePage() {
  const params = useParams()
  const projectId = params.projectId as string

  return (
    <div className="h-full">
      <Timeline projectId={projectId} />
    </div>
  )
}

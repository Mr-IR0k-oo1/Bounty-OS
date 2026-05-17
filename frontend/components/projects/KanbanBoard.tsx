"use client"

import { useState } from "react"
import { DragDropContext } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Plus, Filter, Settings, Search, Download } from "lucide-react"
import { KanbanColumn } from "./KanbanColumn"

export function KanbanBoard({
  projectId,
}: {
  projectId: string
}) {
  const [columns, setColumns] = useState([
    {
      id: "backlog",
      title: "Backlog",
      color: "#3b82f6",
      findings: [
        {
          id: "1",
          title: "STORED XSS IN /PROFILE_UPLOADER",
          severity: "critical",
          program: "uber.com",
          assigned: "@ALICE",
          timestamp: "2D AGO",
        },
        {
          id: "2",
          title: "SQL INJECTION VIA ORDER_BY PARAMETER",
          severity: "high",
          program: "uber.com",
          assigned: "@BOB",
          timestamp: "3D AGO",
        },
      ],
    },
    {
      id: "in_progress",
      title: "In Progress",
      color: "#eab308",
      findings: [
        {
          id: "3",
          title: "CSRF ON ACCOUNT DELETION ENDPOINT",
          severity: "medium",
          program: "uber.com",
          assigned: "@CAROL",
          timestamp: "1D AGO",
        },
      ],
    },
    {
      id: "review",
      title: "Review",
      color: "#94a3b8",
      findings: [],
    },
    {
      id: "submitted",
      title: "Submitted",
      color: "#22c55e",
      findings: [],
    },
    {
      id: "closed",
      title: "Closed",
      color: "#ef4444",
      findings: [],
    },
  ])

  const onDragEnd = (result: any) => {
    if (!result.destination) return

    const sourceColumn = columns.find((col) => col.id === result.source.droppableId)
    const destColumn = columns.find((col) => col.id === result.destination.droppableId)

    if (!sourceColumn || !destColumn) return

    const finding = sourceColumn.findings.find((f) => f.id === result.draggableId)
    if (!finding) return

    const newSourceFindings = sourceColumn.findings.filter(
      (f) => f.id !== result.draggableId
    )

    const newDestFindings = [...destColumn.findings]
    newDestFindings.splice(result.destination.index, 0, finding)

    const newColumns = columns.map((col) => {
      if (col.id === sourceColumn.id) {
        return { ...col, findings: newSourceFindings }
      }
      if (col.id === destColumn.id) {
        return { ...col, findings: newDestFindings }
      }
      return col
    })

    setColumns(newColumns)
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-end justify-between border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-bold text-primary bg-primary/5 border border-primary/20 px-2 py-0.5 w-fit font-mono">
            PROJECT_ID: {projectId.toUpperCase()}
          </div>
          <h2 className="text-2xl font-bold tracking-tight">VULNERABILITY_PIPELINE</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative mr-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="FILTER_VULNS..." 
              className="h-9 w-48 pl-8 text-[11px] font-mono bg-muted/20 border rounded-none focus:outline-none focus:border-primary"
            />
          </div>
          <Button variant="outline" size="sm" className="rounded-none font-mono text-[11px] h-9">
            <Filter className="mr-2 h-3.5 w-3.5" />
            FILTER
          </Button>
          <Button variant="outline" size="sm" className="rounded-none font-mono text-[11px] h-9">
            <Download className="mr-2 h-3.5 w-3.5" />
            EXPORT
          </Button>
          <Button size="sm" className="rounded-none font-mono text-[11px] h-9">
            <Plus className="mr-2 h-3.5 w-3.5" />
            NEW_FINDING
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 h-full min-w-max">
          <DragDropContext onDragEnd={onDragEnd}>
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                findings={column.findings}
              />
            ))}
          </DragDropContext>
          
          <button className="flex-shrink-0 w-80 h-full border border-dashed border-border/50 bg-muted/5 hover:bg-muted/10 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground group">
            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold tracking-widest uppercase">Add Pipeline Stage</span>
          </button>
        </div>
      </div>
    </div>
  )
}

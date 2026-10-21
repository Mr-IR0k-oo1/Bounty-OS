"use client"

import { useState, useEffect, useCallback } from "react"
import { DragDropContext } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Plus, Filter, Settings, Search, Download, RefreshCw } from "lucide-react"
import { KanbanColumn } from "./KanbanColumn"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/useToast"
import type { Finding } from "@/lib/types"

const COLUMNS_DEF = [
  { id: "backlog", title: "Backlog", color: "#3b82f6" },
  { id: "in_progress", title: "In Progress", color: "#eab308" },
  { id: "review", title: "Review", color: "#94a3b8" },
  { id: "submitted", title: "Submitted", color: "#22c55e" },
  { id: "closed", title: "Closed", color: "#ef4444" },
]

export function KanbanBoard({
  projectId,
}: {
  projectId: string
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [filterSearch, setFilterSearch] = useState("")

  const [columns, setColumns] = useState(
    COLUMNS_DEF.map(col => ({ ...col, findings: [] as any[] }))
  )

  const loadFindings = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch project findings or general findings if demo id
      let data: Finding[] = []
      try {
        data = await api.listProjectFindings(projectId)
      } catch {
        data = await api.listFindings()
      }

      const cols = COLUMNS_DEF.map(col => {
        const colFindings = (data || [])
          .filter(f => {
            const currentCol = f.kanban_column || (f.status === "new" ? "backlog" : f.status === "triaged" ? "in_progress" : f.status === "validated" ? "review" : f.status === "submitted" ? "submitted" : "closed")
            return currentCol === col.id
          })
          .map(f => ({
            id: String(f.id),
            title: f.title,
            severity: (f.severity || "info").toLowerCase(),
            program: (f as any).program?.name || "Program",
            assigned: f.assigned_to ? "@ASSIGNED" : "@UNASSIGNED",
            timestamp: f.created_at ? new Date(f.created_at).toLocaleDateString([], { month: "short", day: "numeric" }) : "Recently",
          }))
        return {
          ...col,
          findings: colFindings,
        }
      })
      setColumns(cols)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to load kanban", description: e.message })
    } finally {
      setLoading(false)
    }
  }, [projectId, toast])

  useEffect(() => {
    loadFindings()
  }, [loadFindings])

  const onDragEnd = async (result: any) => {
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

    // Sync with backend API
    try {
      await api.moveFindingKanban(finding.id, destColumn.id)
      toast({
        title: "Finding moved",
        description: `Moved "${finding.title}" to ${destColumn.title}.`,
      })
    } catch {
      // If error or non-UUID, keep UI updated
    }
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-end justify-between border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-bold text-primary bg-primary/5 border border-primary/20 px-2 py-0.5 w-fit font-mono">
            ENGAGEMENT_ID: {projectId.slice(0, 8).toUpperCase()}
          </div>
          <h2 className="text-2xl font-bold tracking-tight">VULNERABILITY_PIPELINE</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative mr-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="FILTER_VULNS..." 
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="h-9 w-48 pl-8 text-[11px] font-mono bg-muted/20 border rounded-none focus:outline-none focus:border-primary"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => loadFindings()} className="rounded-none font-mono text-[11px] h-9">
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            REFRESH
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 h-full min-w-max">
          <DragDropContext onDragEnd={onDragEnd}>
            {columns.map((column) => {
              const displayFindings = filterSearch
                ? column.findings.filter(f => f.title.toLowerCase().includes(filterSearch.toLowerCase()))
                : column.findings
              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  findings={displayFindings}
                />
              )
            })}
          </DragDropContext>
        </div>
      </div>
    </div>
  )
}

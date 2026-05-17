"use client"

import { Droppable, Draggable } from "@hello-pangea/dnd"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KanbanCard } from "./KanbanCard"

export function KanbanColumn({
  column,
  findings,
}: {
  column: {
    id: string
    title: string
    color: string
  }
  findings: Array<{
    id: string
    title: string
    severity: string
    program: string
    assigned: string
    timestamp: string
  }>
}) {
  return (
    <div className="flex-shrink-0 w-80 h-full flex flex-col">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-4 bg-primary" style={{ backgroundColor: column.color }} />
          <h3 className="text-[11px] font-bold uppercase tracking-widest">{column.title}</h3>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 border">
            {findings.length.toString().padStart(2, '0')}
          </span>
        </div>
      </div>
      
      <div className="flex-1 bg-muted/5 border border-dashed border-border/50 p-2 min-h-[500px]">
        <Droppable droppableId={column.id}>
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2 h-full"
            >
              {findings.map((finding, index) => (
                <Draggable key={finding.id} draggableId={finding.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="outline-none"
                    >
                      <KanbanCard finding={finding} />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </div>
  )
}

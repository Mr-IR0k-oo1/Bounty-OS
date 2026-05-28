'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Calendar, Filter, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TimelineEvent {
  id: string
  type: 'scan' | 'finding' | 'submission' | 'bounty' | 'note' | 'status_change'
  message: string
  timestamp: string
  programName?: string
  severity?: string
}

interface ProjectTimelineProps {
  events: TimelineEvent[]
  onRefresh?: () => void
}

const eventStyles: Record<string, string> = {
  scan: 'border-l-severity-info',
  finding: 'border-l-severity-high',
  submission: 'border-l-severity-medium',
  bounty: 'border-l-severity-low',
  note: 'border-l-border',
  status_change: 'border-l-severity-critical',
}

const eventIcons: Record<string, string> = {
  scan: 'SCN',
  finding: 'VUL',
  submission: 'SUB',
  bounty: 'BON',
  note: 'NTE',
  status_change: 'STS',
}

export function ProjectTimeline({ events, onRefresh }: ProjectTimelineProps) {
  const [filter, setFilter] = useState<string>('all')
  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter)

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-text-secondary" />
          <h2 className="text-lg font-bold text-text-primary">Timeline</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-bg-surface rounded-md p-1">
            {['all', 'scan', 'finding', 'submission', 'bounty', 'note'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 text-xs font-medium rounded ${
                  filter === f ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {onRefresh && (
            <Button variant="ghost" size="icon" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">No timeline events found</div>
      ) : (
        <div className="space-y-1">
          {filtered.map((event) => (
            <div
              key={event.id}
              className={`flex items-start gap-4 pl-4 border-l-2 py-3 hover:bg-bg-surface transition-colors rounded-r-md ${eventStyles[event.type] || 'border-l-border'}`}
            >
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-bg-elevated rounded text-[10px] font-mono font-bold text-text-muted">
                {eventIcons[event.type] || 'EVT'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary">{event.message}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-text-muted font-mono">
                    {format(parseISO(event.timestamp), 'MMM dd, HH:mm')}
                  </span>
                  {event.programName && (
                    <span className="text-xs text-text-subtle bg-bg-subtle px-1.5 py-0.5 rounded">
                      {event.programName}
                    </span>
                  )}
                  {event.severity && (
                    <span
                      className={`text-xs font-medium ${
                        event.severity === 'critical'
                          ? 'text-severity-critical'
                          : event.severity === 'high'
                            ? 'text-severity-high'
                            : event.severity === 'medium'
                              ? 'text-severity-medium'
                              : 'text-severity-low'
                      }`}
                    >
                      {event.severity.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

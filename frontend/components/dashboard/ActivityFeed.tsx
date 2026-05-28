'use client'

import { format, parseISO } from 'date-fns'
import { Activity, Bug, Target, DollarSign, FileText, AlertTriangle } from 'lucide-react'

interface ActivityEntry {
  id: string
  type: 'finding' | 'scan' | 'program' | 'bounty' | 'report' | 'alert'
  message: string
  timestamp: string
  programName?: string
}

interface ActivityFeedProps {
  activities: ActivityEntry[]
  maxItems?: number
}

const activityIcons: Record<string, React.ElementType> = {
  finding: Bug,
  scan: Target,
  program: Target,
  bounty: DollarSign,
  report: FileText,
  alert: AlertTriangle,
}

const activityColors: Record<string, string> = {
  finding: 'text-severity-high',
  scan: 'text-severity-info',
  program: 'text-severity-medium',
  bounty: 'text-severity-low',
  report: 'text-text-secondary',
  alert: 'text-severity-critical',
}

const activityBgColors: Record<string, string> = {
  finding: 'bg-severity-high/10',
  scan: 'bg-severity-info/10',
  program: 'bg-severity-medium/10',
  bounty: 'bg-severity-low/10',
  report: 'bg-bg-subtle',
  alert: 'bg-severity-critical/10',
}

export function ActivityFeed({ activities, maxItems = 10 }: ActivityFeedProps) {
  const displayed = activities.slice(0, maxItems)

  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <Activity className="w-4 h-4 text-text-muted" />
          Activity Feed
          <span className="text-xs font-normal text-text-muted ml-auto">{activities.length} events</span>
        </h3>
      </div>
      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
        {displayed.length === 0 ? (
          <div className="text-center py-8 text-sm text-text-muted">No recent activity</div>
        ) : (
          displayed.map((entry) => {
            const Icon = activityIcons[entry.type] || Activity
            const color = activityColors[entry.type] || 'text-text-muted'
            const bgColor = activityBgColors[entry.type] || 'bg-bg-subtle'

            return (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-bg-surface transition-colors">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full ${bgColor} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">{entry.message}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-text-muted font-mono">
                      {format(parseISO(entry.timestamp), 'MMM dd, HH:mm')}
                    </span>
                    {entry.programName && (
                      <span className="text-[10px] text-text-subtle bg-bg-subtle px-1.5 py-0.5 rounded">
                        {entry.programName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

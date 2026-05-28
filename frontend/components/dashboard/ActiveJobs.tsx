'use client'

import React from 'react'
import { Loader2, XCircle, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ScanJob, JobStatus } from '@/lib/types'

interface ActiveJobsProps {
  jobs: ScanJob[]
  onCancel?: (id: string) => Promise<void>
}

const statusIcons: Record<JobStatus, React.ElementType> = {
  queued: Clock,
  running: Loader2,
  done: CheckCircle,
  failed: AlertCircle,
  cancelled: XCircle,
}

const statusColors: Record<JobStatus, string> = {
  queued: 'text-text-muted',
  running: 'text-severity-info',
  done: 'text-severity-low',
  failed: 'text-severity-critical',
  cancelled: 'text-text-muted',
}

const stageLabels: Record<number, string> = {
  1: 'Subdomain Enumeration',
  2: 'Host Discovery',
  3: 'Port Scanning',
  4: 'Content Discovery',
  5: 'Vulnerability Detection',
}

export function ActiveJobs({ jobs, onCancel }: ActiveJobsProps) {
  const active = jobs.filter((j) => j.status === 'queued' || j.status === 'running')
  const recent = jobs.filter((j) => j.status === 'done' || j.status === 'failed' || j.status === 'cancelled').slice(0, 5)

  function JobRow({ job }: { job: ScanJob }) {
    const Icon = statusIcons[job.status]
    const color = statusColors[job.status]

    return (
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-bg-surface transition-colors rounded-lg">
        <div className={`flex-shrink-0 ${job.status === 'running' ? 'animate-spin' : ''}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">
              Stage {job.stage}: {stageLabels[job.stage] || `Stage ${job.stage}`}
            </span>
            <span className={`text-[10px] font-mono uppercase tracking-wider ${color}`}>
              {job.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] font-mono text-text-muted">
            {job.tool && <span>Tool: {job.tool}</span>}
            {job.startedAt && <span>Started: {new Date(job.startedAt).toLocaleTimeString()}</span>}
            {job.triggeredBy && <span>By: {job.triggeredBy.username}</span>}
            {job.findingsCount > 0 && <span>Findings: {job.findingsCount}</span>}
          </div>
          {(job.status === 'running' || job.status === 'queued') && onCancel && (
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-severity-high text-xs"
                onClick={() => onCancel(job.id)}
              >
                <XCircle className="w-3 h-3 mr-1" /> Cancel
              </Button>
            </div>
          )}
          {job.status === 'failed' && job.errorMessage && (
            <p className="text-[10px] text-severity-high mt-1 font-mono">{job.errorMessage}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-text-muted" />
          Active Jobs
        </h3>
        <span className="text-xs text-text-muted font-mono">{active.length} active</span>
      </div>

      <div className="divide-y divide-border">
        {active.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-text-muted">No active jobs</div>
        ) : (
          active.map((job) => <JobRow key={job.id} job={job} />)
        )}
      </div>

      {recent.length > 0 && (
        <>
          <div className="px-4 py-2 border-t border-border bg-bg-surface text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Recent
          </div>
          <div className="divide-y divide-border">
            {recent.map((job) => (
              <div key={job.id} className="px-4 py-2 hover:bg-bg-surface transition-colors">
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex-shrink-0">
                    {React.createElement(statusIcons[job.status], { className: `w-3 h-3 ${statusColors[job.status]}` })}
                  </div>
                  <span className="font-mono text-text-muted">
                    Stage {job.stage}
                    {job.findingsCount > 0 && <> · {job.findingsCount} findings</>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

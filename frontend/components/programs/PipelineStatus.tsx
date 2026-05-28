'use client'

import { CheckCircle, XCircle, Clock, Loader2, ArrowRight } from 'lucide-react'
import type { ScanJob, JobStatus } from '@/lib/types'

interface PipelineStage {
  stage: number
  label: string
  description: string
  lastRun: string | null
  duration: string | null
  status: JobStatus | null
}

interface PipelineStatusProps {
  jobs: ScanJob[]
  onViewLogs?: (jobId: string) => void
}

const stageLabels: Record<number, { label: string; description: string }> = {
  1: { label: 'Subdomain Enumeration', description: 'Discover subdomains via passive and active sources' },
  2: { label: 'Host Discovery', description: 'Probe hosts for liveness and fingerprint services' },
  3: { label: 'Port Scanning', description: 'Scan open ports and enumerate service banners' },
  4: { label: 'Content Discovery', description: 'Crawl and brute-force URL paths and parameters' },
  5: { label: 'Vulnerability Detection', description: 'Automated scanning for common vulnerabilities' },
}

function statusIcon(status: JobStatus | null) {
  switch (status) {
    case 'done':
      return <CheckCircle className="w-5 h-5 text-severity-low" />
    case 'failed':
      return <XCircle className="w-5 h-5 text-severity-critical" />
    case 'running':
      return <Loader2 className="w-5 h-5 text-severity-info animate-spin" />
    case 'queued':
      return <Clock className="w-5 h-5 text-text-muted" />
    case 'cancelled':
      return <XCircle className="w-5 h-5 text-text-muted" />
    default:
      return <Clock className="w-5 h-5 text-text-muted" />
  }
}

export function PipelineStatus({ jobs, onViewLogs }: PipelineStatusProps) {
  const stages: PipelineStage[] = [1, 2, 3, 4, 5].map((stage) => {
    const job = jobs.filter((j) => j.stage === stage).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    return {
      stage,
      label: stageLabels[stage].label,
      description: stageLabels[stage].description,
      lastRun: job?.startedAt || null,
      duration: job?.finishedAt && job?.startedAt
        ? `${Math.round((new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()) / 60000)}m`
        : null,
      status: job?.status || null,
      jobId: job?.id,
    }
  })

  return (
    <div className="card p-6">
      <h3 className="text-lg font-bold text-text-primary mb-6">Pipeline Status</h3>
      <div className="space-y-0">
        {stages.map((stage, idx) => (
          <div key={stage.stage} className="relative">
            <div className="flex items-start gap-4 p-4 hover:bg-bg-surface transition-colors rounded-lg">
              <div className="flex-shrink-0 mt-0.5">{statusIcon(stage.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-text-primary">Stage {stage.stage}: {stage.label}</h4>
                  {stage.status && (
                    <span className={`text-[10px] font-mono uppercase tracking-wider ${
                      stage.status === 'done' ? 'text-severity-low' :
                      stage.status === 'failed' ? 'text-severity-critical' :
                      stage.status === 'running' ? 'text-severity-info' :
                      'text-text-muted'
                    }`}>
                      {stage.status}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-1">{stage.description}</p>
                <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-text-subtle">
                  {stage.lastRun && <span>Last run: {new Date(stage.lastRun).toLocaleString()}</span>}
                  {stage.duration && <span>Duration: {stage.duration}</span>}
                </div>
              </div>
              {(stage as any).jobId && onViewLogs && (
                <button
                  onClick={() => onViewLogs((stage as any).jobId)}
                  className="text-xs text-primary hover:underline flex-shrink-0"
                >
                  View Logs
                </button>
              )}
            </div>
            {idx < stages.length - 1 && (
              <div className="ml-6 pl-[26px]">
                <ArrowRight className="w-4 h-4 text-text-muted rotate-90 mx-auto" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

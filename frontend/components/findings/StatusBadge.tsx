import type { FindingStatus } from '@/lib/types'

const statusConfig: Record<FindingStatus, { bg: string; text: string; label: string }> = {
  new: { bg: 'bg-severity-info/10', text: 'text-severity-info', label: 'New' },
  triaged: { bg: 'bg-severity-medium/10', text: 'text-severity-medium', label: 'Triaged' },
  validated: { bg: 'bg-severity-low/10', text: 'text-severity-low', label: 'Validated' },
  submitted: { bg: 'bg-primary/10', text: 'text-primary', label: 'Submitted' },
  fp: { bg: 'bg-severity-critical/10', text: 'text-severity-critical', label: 'False Positive' },
  dup: { bg: 'bg-bg-subtle', text: 'text-text-muted', label: 'Duplicate' },
  na: { bg: 'bg-bg-subtle', text: 'text-text-muted', label: 'N/A' },
  bounty_awarded: { bg: 'bg-severity-low/10', text: 'text-severity-low', label: 'Bounty Paid' },
}

interface StatusBadgeProps {
  status: FindingStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]
  if (!config) return <span className="text-xs text-text-muted">{status}</span>

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

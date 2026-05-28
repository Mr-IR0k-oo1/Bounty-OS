import type { Severity } from '@/lib/types'

const severityConfig: Record<Severity, { bg: string; text: string; dot: string; label: string }> = {
  critical: { bg: 'bg-severity-critical/10', text: 'text-severity-critical', dot: 'bg-severity-critical', label: 'Critical' },
  high: { bg: 'bg-severity-high/10', text: 'text-severity-high', dot: 'bg-severity-high', label: 'High' },
  medium: { bg: 'bg-severity-medium/10', text: 'text-severity-medium', dot: 'bg-severity-medium', label: 'Medium' },
  low: { bg: 'bg-severity-low/10', text: 'text-severity-low', dot: 'bg-severity-low', label: 'Low' },
  info: { bg: 'bg-severity-info/10', text: 'text-severity-info', dot: 'bg-severity-info', label: 'Info' },
}

interface SeverityBadgeProps {
  severity: Severity
  size?: 'sm' | 'md' | 'lg'
}

export function SeverityBadge({ severity, size = 'md' }: SeverityBadgeProps) {
  const config = severityConfig[severity] || severityConfig.info
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded ${config.bg} ${config.text} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

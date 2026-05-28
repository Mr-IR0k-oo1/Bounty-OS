'use client'

import type { Severity } from '@/lib/types'

interface SeverityChartProps {
  data: Record<Severity, number>
}

const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

const severityColors: Record<Severity, { bg: string; text: string; bar: string }> = {
  critical: { bg: 'bg-severity-critical/10', text: 'text-severity-critical', bar: 'bg-severity-critical' },
  high: { bg: 'bg-severity-high/10', text: 'text-severity-high', bar: 'bg-severity-high' },
  medium: { bg: 'bg-severity-medium/10', text: 'text-severity-medium', bar: 'bg-severity-medium' },
  low: { bg: 'bg-severity-low/10', text: 'text-severity-low', bar: 'bg-severity-low' },
  info: { bg: 'bg-severity-info/10', text: 'text-severity-info', bar: 'bg-severity-info' },
}

export function SeverityChart({ data }: SeverityChartProps) {
  const total = Object.values(data).reduce((sum, v) => sum + v, 0)

  return (
    <div className="card p-6">
      <h3 className="text-sm font-bold text-text-primary mb-6">Severity Distribution</h3>

      {total === 0 ? (
        <div className="text-center py-6 text-sm text-text-muted">No findings data</div>
      ) : (
        <div className="space-y-4">
          {severityOrder.map((severity) => {
            const count = data[severity] || 0
            const percentage = total > 0 ? (count / total) * 100 : 0
            const colors = severityColors[severity]

            return (
              <div key={severity} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${colors.bar}`} />
                    <span className="font-medium capitalize text-text-primary">{severity}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-text-primary">{count}</span>
                    <span className="text-xs text-text-muted w-10 text-right font-mono">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-bg-surface rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}

          <div className="pt-3 border-t border-border flex justify-between text-[10px] text-text-muted font-mono">
            <span>Total: {total} findings</span>
          </div>
        </div>
      )}
    </div>
  )
}

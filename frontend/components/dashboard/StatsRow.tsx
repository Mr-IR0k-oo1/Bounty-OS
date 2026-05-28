'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatItem {
  label: string
  value: string | number
  change?: { value: number; positive: boolean }
}

interface StatsRowProps {
  stats: StatItem[]
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="card p-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">{stat.label}</div>
          <div className="text-3xl font-black font-mono text-text-primary">{stat.value}</div>
          {stat.change && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${stat.change.positive ? 'text-severity-low' : 'text-severity-high'}`}>
              {stat.change.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{stat.change.value}%</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

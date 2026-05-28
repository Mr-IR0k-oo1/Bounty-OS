'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Target, Globe, DollarSign, Shield, Activity } from 'lucide-react'
import type { Program } from '@/lib/types'
import { SeverityBadge } from '@/components/findings/SeverityBadge'

const platformColors: Record<string, string> = {
  h1: 'bg-severity-critical/10 text-severity-critical border-severity-critical/20',
  bugcrowd: 'bg-severity-high/10 text-severity-high border-severity-high/20',
  intigriti: 'bg-severity-medium/10 text-severity-medium border-severity-medium/20',
  synack: 'bg-severity-low/10 text-severity-low border-severity-low/20',
  other: 'bg-bg-subtle text-text-muted border-border',
}

interface ProgramCardProps {
  program: Program
}

export function ProgramCard({ program }: ProgramCardProps) {
  const stats = program.stats

  return (
    <Link href={`/programs/${program.id}`}>
      <Card className="card hover:border-primary transition-colors cursor-pointer group">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">
              {program.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${platformColors[program.platform] || platformColors.other}`}
              >
                <Globe className="w-3 h-3" />
                {program.platform}
              </span>
              <Badge
                variant={program.status === 'active' ? 'default' : program.status === 'paused' ? 'secondary' : 'outline'}
                className="text-[10px]"
              >
                {program.status}
              </Badge>
            </div>
          </div>
          {program.activeApproved && (
            <Shield className="w-4 h-4 text-severity-low" />
          )}
        </CardHeader>
        <CardContent>
          {stats && (
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div className="text-center">
                <div className="text-lg font-bold font-mono text-text-primary">{stats.subdomainCount}</div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider">Subs</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold font-mono text-text-primary">{stats.liveHostCount}</div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider">Live</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold font-mono text-text-primary">{stats.portCount}</div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider">Ports</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold font-mono text-text-primary">{stats.urlCount}</div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider">URLs</div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {stats && Object.entries(stats.findingsBySeverity).map(([sev, count]) =>
                count > 0 ? <SeverityBadge key={sev} severity={sev as any} size="sm" /> : null
              )}
            </div>
            {program.bountyRangeLow != null && (
              <div className="flex items-center gap-1 text-sm font-medium text-text-secondary">
                <DollarSign className="w-3 h-3" />
                {program.bountyRangeLow}–{program.bountyRangeHigh || '∞'}
              </div>
            )}
          </div>
          {program.lastScannedAt && (
            <div className="mt-3 flex items-center gap-1 text-[10px] text-text-muted font-mono">
              <Activity className="w-3 h-3" />
              Last scan: {new Date(program.lastScannedAt).toLocaleDateString()}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

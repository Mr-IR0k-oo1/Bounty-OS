'use client'

import { useState } from 'react'
import { ArrowUpDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SeverityBadge } from './SeverityBadge'
import { StatusBadge } from './StatusBadge'
import type { Finding, Severity } from '@/lib/types'

interface FindingsTableProps {
  findings: Finding[]
  onRowClick?: (finding: Finding) => void
  filters?: Record<string, string>
}

type SortKey = 'severity' | 'title' | 'status' | 'foundAt' | 'assignedTo'

const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }

export function FindingsTable({ findings, onRowClick, filters: _filters }: FindingsTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('severity')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = findings
    .filter((f) => !search || f.title.toLowerCase().includes(search.toLowerCase()) || f.id.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'severity':
          cmp = (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)
          break
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'foundAt':
          cmp = new Date(a.foundAt).getTime() - new Date(b.foundAt).getTime()
          break
        case 'assignedTo':
          cmp = (a.assignedTo?.username || '').localeCompare(b.assignedTo?.username || '')
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: 'severity', label: 'Severity', className: 'w-24' },
    { key: 'title', label: 'Title' },
    { key: 'status', label: 'Status', className: 'w-28' },
    { key: 'assignedTo', label: 'Assigned', className: 'w-32' },
    { key: 'foundAt', label: 'Date', className: 'w-36' },
  ]

  return (
    <div className="card">
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <Input
            placeholder="Search findings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-surface">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-primary ${col.className || ''}`}
                  onClick={() => toggleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-text-muted text-sm">
                  No findings found
                </td>
              </tr>
            ) : (
              filtered.map((finding) => (
                <tr
                  key={finding.id}
                  className="border-b border-border hover:bg-bg-surface transition-colors cursor-pointer"
                  onClick={() => onRowClick?.(finding)}
                >
                  <td className="px-4 py-3">
                    <SeverityBadge severity={finding.severity} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{finding.title}</div>
                    <div className="text-xs text-text-muted font-mono">{finding.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={finding.status} />
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {finding.assignedTo?.username || <span className="text-text-muted italic">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs font-mono">
                    {new Date(finding.foundAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

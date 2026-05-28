'use client'

import { useState } from 'react'
import { ArrowUpDown, Search, Globe, Wifi } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Subdomain } from '@/lib/types'

interface SubdomainTableProps {
  subdomains: Subdomain[]
  onSelect?: (subdomain: Subdomain) => void
}

type SortKey = 'subdomain' | 'ipAddress' | 'statusCode' | 'title' | 'webServer'

export function SubdomainTable({ subdomains, onSelect }: SubdomainTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('subdomain')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [aliveFilter, setAliveFilter] = useState<'all' | 'alive' | 'dead'>('all')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = subdomains
    .filter((s) => aliveFilter === 'all' || (aliveFilter === 'alive' ? s.isAlive : !s.isAlive))
    .filter((s) => !search || s.subdomain.toLowerCase().includes(search.toLowerCase()) || (s.title || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'subdomain': cmp = a.subdomain.localeCompare(b.subdomain); break
        case 'ipAddress': cmp = (a.ipAddress || '').localeCompare(b.ipAddress || ''); break
        case 'statusCode': cmp = (a.statusCode || 0) - (b.statusCode || 0); break
        case 'title': cmp = (a.title || '').localeCompare(b.title || ''); break
        case 'webServer': cmp = (a.webServer || '').localeCompare(b.webServer || ''); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: 'subdomain', label: 'Subdomain', className: 'flex-1' },
    { key: 'ipAddress', label: 'IP', className: 'w-36' },
    { key: 'statusCode', label: 'Status', className: 'w-20' },
    { key: 'title', label: 'Title', className: 'w-48' },
    { key: 'webServer', label: 'Server', className: 'w-28' },
  ]

  return (
    <div className="card">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <Input placeholder="Search subdomains..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex items-center gap-1 bg-bg-surface rounded-md p-1">
          {(['all', 'alive', 'dead'] as const).map((f) => (
            <Button
              key={f}
              variant={aliveFilter === f ? 'default' : 'ghost'}
              size="sm"
              className="text-xs"
              onClick={() => setAliveFilter(f)}
            >
              {f === 'alive' && <Wifi className="w-3 h-3 mr-1" />}
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-surface">
              <th className="w-12 px-4 py-3"></th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-primary ${col.className || ''}`}
                  onClick={() => toggleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label} <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              ))}
              <th className="w-32 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Tech</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-text-muted text-sm">No subdomains found</td>
              </tr>
            ) : (
              filtered.map((sub) => (
                <tr
                  key={sub.id}
                  className="border-b border-border hover:bg-bg-surface transition-colors cursor-pointer"
                  onClick={() => onSelect?.(sub)}
                >
                  <td className="px-4 py-3">
                    <div className={`w-2 h-2 rounded-full ${sub.isAlive ? 'bg-severity-low' : 'bg-text-muted'}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-text-muted" />
                      <span className="font-mono text-text-primary text-xs">{sub.subdomain}</span>
                    </div>
                    {sub.isNew && <span className="text-[9px] text-severity-info font-bold uppercase ml-1">NEW</span>}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-text-secondary">{sub.ipAddress || '-'}</td>
                  <td className="px-4 py-3">
                    {sub.statusCode && (
                      <span className={`text-xs font-mono ${
                        sub.statusCode < 300 ? 'text-severity-low' :
                        sub.statusCode < 400 ? 'text-severity-medium' :
                        'text-severity-high'
                      }`}>
                        {sub.statusCode}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary truncate max-w-[200px]">{sub.title || '-'}</td>
                  <td className="px-4 py-3 text-xs text-text-muted font-mono">{sub.webServer || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {sub.techStack.slice(0, 3).map((tech) => (
                        <span key={tech} className="px-1 py-0.5 text-[9px] bg-bg-subtle text-text-muted rounded font-mono">
                          {tech}
                        </span>
                      ))}
                      {sub.techStack.length > 3 && (
                        <span className="text-[9px] text-text-muted">+{sub.techStack.length - 3}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-border text-[10px] text-text-muted font-mono">
        {filtered.length} of {subdomains.length} subdomains
      </div>
    </div>
  )
}

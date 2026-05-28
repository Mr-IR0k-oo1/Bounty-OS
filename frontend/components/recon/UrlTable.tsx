'use client'

import { useState } from 'react'
import { ArrowUpDown, Search, Link as LinkIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { DiscoveredUrl } from '@/lib/types'

interface UrlTableProps {
  urls: DiscoveredUrl[]
  onSelect?: (url: DiscoveredUrl) => void
}

type SortKey = 'url' | 'method' | 'statusCode' | 'contentLength' | 'source'

export function UrlTable({ urls, onSelect }: UrlTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('url')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [methodFilter, setMethodFilter] = useState<string>('all')

  const methods = [...new Set(urls.map((u) => u.method))]

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = urls
    .filter((u) => methodFilter === 'all' || u.method === methodFilter)
    .filter((u) => !search || u.url.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'url': cmp = a.url.localeCompare(b.url); break
        case 'method': cmp = a.method.localeCompare(b.method); break
        case 'statusCode': cmp = (a.statusCode || 0) - (b.statusCode || 0); break
        case 'contentLength': cmp = (a.contentLength || 0) - (b.contentLength || 0); break
        case 'source': cmp = a.source.localeCompare(b.source); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: 'url', label: 'URL', className: 'flex-1' },
    { key: 'method', label: 'Method', className: 'w-20' },
    { key: 'statusCode', label: 'Status', className: 'w-20' },
    { key: 'contentLength', label: 'Size', className: 'w-20' },
    { key: 'source', label: 'Source', className: 'w-24' },
  ]

  return (
    <div className="card">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <Input placeholder="Search URLs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex items-center gap-1 bg-bg-surface rounded-md p-1">
          <button
            onClick={() => setMethodFilter('all')}
            className={`px-2 py-1 text-xs font-medium rounded ${methodFilter === 'all' ? 'bg-bg-elevated text-text-primary' : 'text-text-muted'}`}
          >
            All
          </button>
          {methods.map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`px-2 py-1 text-xs font-medium rounded ${methodFilter === m ? 'bg-bg-elevated text-text-primary' : 'text-text-muted'}`}
            >
              {m}
            </button>
          ))}
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
                  <div className="flex items-center gap-1">{col.label} <ArrowUpDown className="w-3 h-3" /></div>
                </th>
              ))}
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Params</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-text-muted text-sm">No URLs found</td>
              </tr>
            ) : (
              filtered.map((url) => (
                <tr
                  key={url.id}
                  className="border-b border-border hover:bg-bg-surface transition-colors cursor-pointer"
                  onClick={() => onSelect?.(url)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                      <span className="text-xs font-mono text-primary truncate max-w-[400px]" title={url.url}>
                        {url.url}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-mono font-bold ${
                      url.method === 'GET' ? 'text-severity-low' :
                      url.method === 'POST' ? 'text-severity-medium' :
                      url.method === 'PUT' ? 'text-severity-info' :
                      'text-severity-high'
                    }`}>
                      {url.method}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {url.statusCode && (
                      <span className={`text-xs font-mono ${
                        url.statusCode < 300 ? 'text-severity-low' :
                        url.statusCode < 400 ? 'text-severity-medium' :
                        'text-severity-high'
                      }`}>
                        {url.statusCode}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-text-muted">
                    {url.contentLength != null ? `${(url.contentLength / 1024).toFixed(1)}K` : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{url.source}</td>
                  <td className="px-4 py-3">
                    {url.params.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {url.params.slice(0, 3).map((p) => (
                          <span key={p} className="px-1 py-0.5 text-[9px] bg-bg-subtle text-text-muted rounded font-mono">{p}</span>
                        ))}
                        {url.params.length > 3 && <span className="text-[9px] text-text-muted">+{url.params.length - 3}</span>}
                      </div>
                    ) : (
                      <span className="text-[10px] text-text-muted">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-border text-[10px] text-text-muted font-mono">
        {filtered.length} of {urls.length} URLs
      </div>
    </div>
  )
}

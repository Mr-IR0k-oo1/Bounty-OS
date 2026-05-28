'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Wifi, Server } from 'lucide-react'
import type { Port, Subdomain } from '@/lib/types'

interface PortMapProps {
  ports: Port[]
  subdomains: Subdomain[]
}

export function PortMap({ ports, subdomains }: PortMapProps) {
  const grouped = subdomains.reduce(
    (acc, sub) => {
      const subPorts = ports.filter((p) => p.subdomainId === sub.id)
      if (subPorts.length > 0) acc[sub.id] = { subdomain: sub, ports: subPorts }
      return acc
    },
    {} as Record<string, { subdomain: Subdomain; ports: Port[] }>
  )

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  function toggle(id: string) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }))
  }

  const entries = Object.values(grouped)

  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Server className="w-4 h-4 text-text-muted" />
        <span className="text-sm font-semibold text-text-primary">Port Map</span>
        <span className="text-xs text-text-muted ml-auto">{entries.length} hosts, {ports.length} ports</span>
      </div>
      {entries.length === 0 ? (
        <div className="text-center py-8 text-text-muted text-sm">No port data available</div>
      ) : (
        <div className="divide-y divide-border">
          {entries.map(({ subdomain, ports: hostPorts }) => (
            <div key={subdomain.id}>
              <button
                onClick={() => toggle(subdomain.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-surface transition-colors text-left"
              >
                {expanded[subdomain.id] ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                <Wifi className={`w-4 h-4 ${subdomain.isAlive ? 'text-severity-low' : 'text-text-muted'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono text-text-primary truncate">{subdomain.subdomain}</div>
                  <div className="text-[10px] text-text-muted">{subdomain.ipAddress}</div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {hostPorts.slice(0, 5).map((p) => (
                    <span
                      key={p.id}
                      className="px-1.5 py-0.5 text-[10px] font-mono bg-bg-subtle text-text-muted rounded"
                    >
                      {p.port}/{p.protocol}
                    </span>
                  ))}
                  {hostPorts.length > 5 && (
                    <span className="text-[10px] text-text-muted">+{hostPorts.length - 5}</span>
                  )}
                </div>
              </button>
              {expanded[subdomain.id] && (
                <div className="bg-bg-surface px-4 py-2 space-y-1">
                  {hostPorts.map((p) => (
                    <div key={p.id} className="flex items-center gap-4 px-4 py-2 hover:bg-bg-elevated rounded text-sm">
                      <span className="font-mono font-bold text-text-primary w-20">{p.port}</span>
                      <span className="text-text-muted w-12 text-xs uppercase">{p.protocol}</span>
                      <span className="text-text-secondary flex-1">{p.service || '-'}</span>
                      {p.version && <span className="text-text-muted text-xs font-mono">{p.version}</span>}
                      {p.banner && (
                        <span className="text-text-muted text-[10px] font-mono truncate max-w-[200px]">{p.banner}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

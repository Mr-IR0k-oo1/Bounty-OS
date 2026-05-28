'use client'

import { useState } from 'react'
import { X, ExternalLink, Image as ImageIcon } from 'lucide-react'
import type { Subdomain } from '@/lib/types'

interface ScreenshotGridProps {
  subdomains: Subdomain[]
}

export function ScreenshotGrid({ subdomains }: ScreenshotGridProps) {
  const withScreenshots = subdomains.filter((s) => s.screenshotPath)
  const [selected, setSelected] = useState<Subdomain | null>(null)

  return (
    <div className="space-y-4">
      {withScreenshots.length === 0 ? (
        <div className="card p-12 text-center">
          <ImageIcon className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-muted">No screenshots available</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {withScreenshots.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setSelected(sub)}
              className="card overflow-hidden group hover:border-primary transition-colors text-left"
            >
              <div className="aspect-video bg-bg-surface relative overflow-hidden">
                <img
                  src={sub.screenshotPath!}
                  alt={sub.subdomain}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                <div className="text-xs font-mono text-text-primary truncate">{sub.subdomain}</div>
                <div className="flex items-center gap-2 mt-1 text-[10px]">
                  {sub.statusCode && (
                    <span className={`font-mono ${
                      sub.statusCode < 300 ? 'text-severity-low' :
                      sub.statusCode < 400 ? 'text-severity-medium' :
                      'text-severity-high'
                    }`}>
                      {sub.statusCode}
                    </span>
                  )}
                  {sub.title && <span className="text-text-muted truncate">{sub.title}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8" onClick={() => setSelected(null)}>
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="absolute -top-10 right-0 flex items-center gap-3">
              <a
                href={`//${selected.subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-white/70 hover:text-white"
              >
                <ExternalLink className="w-3 h-3" /> Open
              </a>
              <button onClick={() => setSelected(null)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <img src={selected.screenshotPath!} alt={selected.subdomain} className="w-full rounded-lg shadow-2xl" />
            <div className="mt-3 flex items-center gap-4 text-sm text-white/80">
              <span className="font-mono">{selected.subdomain}</span>
              {selected.statusCode && <span>{selected.statusCode}</span>}
              {selected.title && <span>{selected.title}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

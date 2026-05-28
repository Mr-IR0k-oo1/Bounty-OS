'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Eye, Edit3, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
}

export function MarkdownEditor({ value, onChange, placeholder = 'Write in markdown...', minHeight = 300 }: MarkdownEditorProps) {
  const [view, setView] = useState<'edit' | 'preview' | 'split'>('split')
  const [expanded, setExpanded] = useState(false)

  function renderPreview(md: string): React.ReactNode {
    return md.split('\n').map((line, i) => {
      if (line.startsWith('# '))
        return <h1 key={i} className="text-xl font-bold text-text-primary mt-4 mb-2">{line.slice(2)}</h1>
      if (line.startsWith('## '))
        return <h2 key={i} className="text-lg font-bold text-text-primary mt-3 mb-1">{line.slice(3)}</h2>
      if (line.startsWith('### '))
        return <h3 key={i} className="text-base font-semibold text-text-primary mt-2 mb-1">{line.slice(4)}</h3>
      if (line.startsWith('- '))
        return <li key={i} className="text-sm text-text-secondary ml-4 list-disc">{line.slice(2)}</li>
      if (line.startsWith('> '))
        return <blockquote key={i} className="border-l-2 border-primary pl-3 py-1 my-1 text-sm text-text-secondary italic">{line.slice(2)}</blockquote>
      if (line.match(/^```/))
        return null
      if (line.match(/^`.*`$/))
        return <code key={i} className="text-xs font-mono bg-bg-subtle text-text-primary px-1 py-0.5 rounded">{line.slice(1, -1)}</code>
      if (line === '')
        return <div key={i} className="h-2" />
      if (line.match(/^\*\*.*\*\*$/))
        return <p key={i} className="text-sm font-bold text-text-primary">{line.slice(2, -2)}</p>
      if (line.match(/^\[.*\]\(.*\)$/)) {
        const match = line.match(/^\[(.+)\]\((.+)\)$/)
        if (match) return <a key={i} href={match[2]} className="text-primary hover:underline text-sm">{match[1]}</a>
      }
      if (line.startsWith('|'))
        return <pre key={i} className="text-xs font-mono text-text-secondary whitespace-pre-wrap">{line}</pre>
      return <p key={i} className="text-sm text-text-secondary leading-relaxed">{line}</p>
    })
  }

  const containerHeight = expanded ? 'min-h-[80vh]' : `${minHeight}px`

  return (
    <div className={`card overflow-hidden ${expanded ? 'fixed inset-4 z-50' : ''}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-surface">
        <div className="flex items-center gap-1 bg-bg-elevated rounded-md p-0.5">
          {(['edit', 'split', 'preview'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                view === v ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {v === 'edit' && <Edit3 className="w-3 h-3" />}
              {v === 'preview' && <Eye className="w-3 h-3" />}
              {v === 'split' && <><Edit3 className="w-3 h-3" /><Eye className="w-3 h-3" /></>}
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)}>
          {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>
      </div>

      <div className={`flex ${view === 'split' ? 'flex-row' : 'flex-col'}`} style={{ height: containerHeight }}>
        {(view === 'edit' || view === 'split') && (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`border-0 rounded-none resize-none bg-transparent focus-visible:ring-0 ${
              view === 'split' ? 'w-1/2 border-r border-border' : 'w-full'
            }`}
            style={{ height: view === 'split' ? '100%' : `${minHeight}px` }}
          />
        )}
        {(view === 'preview' || view === 'split') && (
          <div className={`overflow-y-auto p-4 ${view === 'split' ? 'w-1/2' : 'w-full'}`} style={{ height: view === 'split' ? '100%' : `${minHeight}px` }}>
            {value ? (
              renderPreview(value)
            ) : (
              <p className="text-sm text-text-muted">Nothing to preview</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

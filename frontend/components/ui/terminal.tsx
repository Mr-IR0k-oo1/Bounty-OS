'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Check, Trash2 } from 'lucide-react'

interface TerminalProps {
  logs: string[]
  maxHeight?: number
  title?: string
}

export function Terminal({ logs, maxHeight = 400, title = 'Terminal' }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  function stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(logs.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleClear() {
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-bg-base border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-severity-critical" />
            <div className="w-2.5 h-2.5 rounded-full bg-severity-medium" />
            <div className="w-2.5 h-2.5 rounded-full bg-severity-low" />
          </div>
          <span className="text-xs font-semibold text-text-primary font-mono">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-text-muted mr-2">{logs.length} lines</span>
          <button onClick={handleCopy} className="p-1 text-text-muted hover:text-text-primary transition-colors" title="Copy all">
            {copied ? <Check className="w-3.5 h-3.5 text-severity-low" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleClear} className="p-1 text-text-muted hover:text-text-primary transition-colors" title="Clear">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="bg-black text-green-400 p-4 font-mono text-xs leading-relaxed overflow-y-auto whitespace-pre-wrap"
        style={{ maxHeight }}
      >
        {logs.length === 0 ? (
          <span className="text-gray-500">[empty]</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="hover:bg-white/5">
              <span className="text-gray-500 mr-2 select-none">{String(i + 1).padStart(4, ' ')}</span>
              <span>{stripAnsi(line)}</span>
            </div>
          ))
        )}
        <div className="text-gray-500">
          <span className="animate-pulse">█</span>
        </div>
      </div>
    </div>
  )
}

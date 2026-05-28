'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CodeBlockProps {
  code: string
  language?: string
  title?: string
}

export function CodeBlock({ code, language = 'text', title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card overflow-hidden">
      {(title || language) && (
        <div className="flex items-center justify-between px-4 py-2 bg-bg-surface border-b border-border">
          <div className="flex items-center gap-2">
            {title && <span className="text-xs font-medium text-text-primary">{title}</span>}
            <span className="text-[10px] font-mono text-text-muted uppercase">{language}</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary transition-colors rounded hover:bg-bg-elevated"
          >
            {copied ? (
              <><Check className="w-3 h-3 text-severity-low" /> Copied</>
            ) : (
              <><Copy className="w-3 h-3" /> Copy</>
            )}
          </button>
        </div>
      )}
      <pre className="p-4 overflow-x-auto bg-bg-base">
        <code className="text-xs font-mono text-text-secondary leading-relaxed whitespace-pre-wrap break-all">
          {code}
        </code>
      </pre>
    </div>
  )
}

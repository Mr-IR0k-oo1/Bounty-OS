'use client'

import { FileText, Download, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface ReportPreviewProps {
  content: string
  title?: string
  onDownload?: () => void
}

export function ReportPreview({ content, title, onDownload }: ReportPreviewProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-surface">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">{title || 'Report Preview'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 text-severity-low" /> : <Copy className="w-4 h-4" />}
            <span className="ml-1 text-xs">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
          {onDownload && (
            <Button variant="ghost" size="sm" onClick={onDownload}>
              <Download className="w-4 h-4 mr-1" /> Download
            </Button>
          )}
        </div>
      </div>
      <div className="p-4 overflow-auto max-h-[600px]">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {content.split('\n').map((line, i) => {
            if (line.startsWith('# '))
              return <h1 key={i} className="text-xl font-bold text-text-primary mt-4 mb-2">{line.slice(2)}</h1>
            if (line.startsWith('## '))
              return <h2 key={i} className="text-lg font-bold text-text-primary mt-4 mb-2">{line.slice(3)}</h2>
            if (line.startsWith('### '))
              return <h3 key={i} className="text-base font-semibold text-text-primary mt-3 mb-1">{line.slice(4)}</h3>
            if (line.startsWith('|'))
              return <pre key={i} className="text-xs font-mono text-text-secondary whitespace-pre-wrap">{line}</pre>
            if (line.startsWith('```'))
              return null
            if (line.startsWith('**') && line.endsWith('**'))
              return <p key={i} className="text-sm font-bold text-text-primary mt-2">{line.slice(2, -2)}</p>
            if (line.startsWith('─'))
              return <hr key={i} className="my-3 border-border" />
            return <p key={i} className="text-sm text-text-secondary leading-relaxed">{line}</p>
          })}
        </div>
      </div>
    </div>
  )
}

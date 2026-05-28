'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface EvidenceViewerProps {
  request: string | null
  response: string | null
  curlCommand: string | null
}

export function EvidenceViewer({ request, response, curlCommand }: EvidenceViewerProps) {
  const [tab, setTab] = useState<'request' | 'response' | 'curl'>('request')
  const [copied, setCopied] = useState(false)

  function getContent() {
    switch (tab) {
      case 'request':
        return request || 'No request data available'
      case 'response':
        return response || 'No response data available'
      case 'curl':
        return curlCommand || 'No curl command available'
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(getContent())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabs = [
    { id: 'request' as const, label: 'HTTP Request', disabled: !request },
    { id: 'response' as const, label: 'HTTP Response', disabled: !response },
    { id: 'curl' as const, label: 'cURL Command', disabled: !curlCommand },
  ]

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-bg-surface">
        <div className="flex">
          {tabs.map((t) => (
            <button
              key={t.id}
              disabled={t.disabled}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? 'bg-bg-elevated text-text-primary border-b-2 border-primary'
                  : 'text-text-muted hover:text-text-secondary'
              } ${t.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="mr-3 p-1.5 text-text-muted hover:text-text-primary transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-4 h-4 text-severity-low" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed bg-bg-base text-text-secondary max-h-[400px] overflow-y-auto whitespace-pre-wrap break-all">
        {getContent()}
      </pre>
    </div>
  )
}

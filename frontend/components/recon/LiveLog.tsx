'use client'

import { useEffect, useRef } from 'react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Terminal, Wifi, WifiOff } from 'lucide-react'

interface LiveLogProps {
  jobId: string | null
}

export function LiveLog({ jobId }: LiveLogProps) {
  const { logs, connected } = useWebSocket(jobId)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  function stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-bg-base border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-text-muted" />
          <span className="text-xs font-semibold text-text-primary">Live Log</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-text-muted">{logs.length} lines</span>
          <div className="flex items-center gap-1">
            {connected ? (
              <>
                <Wifi className="w-3 h-3 text-severity-low" />
                <span className="text-[10px] text-severity-low">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-text-muted" />
                <span className="text-[10px] text-text-muted">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div
        ref={containerRef}
        className="bg-black text-green-400 p-4 font-mono text-xs leading-relaxed h-[400px] overflow-y-auto whitespace-pre-wrap"
      >
        {logs.length === 0 ? (
          <span className="text-gray-500">Waiting for logs{jobId ? '...' : ' (no job selected)'}</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="hover:bg-white/5">
              <span className="text-gray-500 mr-3 select-none">{String(i + 1).padStart(4, ' ')}</span>
              {stripAnsi(line)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

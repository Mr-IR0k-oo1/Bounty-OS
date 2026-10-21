'use client'

import { useEffect, useRef, useState } from 'react'

export function useWebSocket(jobId: string | null) {
  const [logs, setLogs] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!jobId || typeof window === 'undefined') return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const hostname = window.location.hostname

    let base = process.env.NEXT_PUBLIC_WS_URL
    if (!base || base.startsWith('/')) {
      if (window.location.port === '3000') {
        base = `${protocol}//${hostname}:8000/api/ws`
      } else {
        base = `${protocol}//${window.location.host}/api/ws`
      }
    }

    const ws = new WebSocket(`${base}/jobs/${jobId}`)
    wsRef.current = ws
    ws.onopen = () => setConnected(true)
    ws.onmessage = (event) => setLogs((prev) => [...prev, event.data])
    ws.onclose = () => setConnected(false)
    return () => ws.close()
  }, [jobId])

  return { logs, connected }
}

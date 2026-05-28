'use client'

import { useEffect, useRef, useState } from 'react'

export function useWebSocket(jobId: string | null) {
  const [logs, setLogs] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!jobId) return
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://${window.location.hostname}:8000/ws`
    const ws = new WebSocket(`${wsUrl}/jobs/${jobId}`)
    wsRef.current = ws
    ws.onopen = () => setConnected(true)
    ws.onmessage = (event) => setLogs((prev) => [...prev, event.data])
    ws.onclose = () => setConnected(false)
    return () => ws.close()
  }, [jobId])

  return { logs, connected }
}

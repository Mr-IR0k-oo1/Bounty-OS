'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Finding } from '@/lib/types'
import { api } from '@/lib/api'

export function useFindings(params?: Record<string, string>) {
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFindings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listFindings(params)
      setFindings(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    fetchFindings()
  }, [fetchFindings])

  const getFinding = useCallback(async (id: string) => {
    return api.getFinding(id)
  }, [])

  const claimFinding = useCallback(async (id: string) => {
    const updated = await api.claimFinding(id)
    setFindings((prev) => prev.map((f) => (f.id === id ? updated : f)))
    return updated
  }, [])

  const validateFinding = useCallback(async (id: string) => {
    const updated = await api.validateFinding(id)
    setFindings((prev) => prev.map((f) => (f.id === id ? updated : f)))
    return updated
  }, [])

  return {
    findings,
    loading,
    error,
    refetch: fetchFindings,
    getFinding,
    claimFinding,
    validateFinding,
  }
}

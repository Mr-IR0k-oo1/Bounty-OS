'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Program } from '@/lib/types'
import { api } from '@/lib/api'

export function usePrograms(projectId?: string) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPrograms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listPrograms(projectId)
      setPrograms(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchPrograms()
  }, [fetchPrograms])

  const getProgram = useCallback(async (id: string) => {
    return api.getProgram(id)
  }, [])

  const createProgram = useCallback(
    async (data: Partial<Program>) => {
      if (!projectId) throw new Error('projectId is required to create a program')
      const created = await api.createProgram(projectId, data)
      setPrograms((prev) => [...prev, created])
      return created
    },
    [projectId]
  )

  const approveProgram = useCallback(async (id: string) => {
    const updated = await api.approveProgram(id)
    setPrograms((prev) => prev.map((p) => (p.id === id ? updated : p)))
    return updated
  }, [])

  const scanProgram = useCallback(async (id: string) => {
    return api.scanProgram(id)
  }, [])

  return {
    programs,
    loading,
    error,
    refetch: fetchPrograms,
    getProgram,
    createProgram,
    approveProgram,
    scanProgram,
  }
}

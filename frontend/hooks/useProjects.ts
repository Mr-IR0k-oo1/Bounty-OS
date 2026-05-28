'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Project } from '@/lib/types'
import { api } from '@/lib/api'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listProjects()
      setProjects(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const getProject = useCallback(async (id: string) => {
    return api.getProject(id)
  }, [])

  const createProject = useCallback(async (data: Partial<Project>) => {
    const created = await api.createProject(data)
    setProjects((prev) => [...prev, created])
    return created
  }, [])

  const updateProject = useCallback(async (id: string, data: Partial<Project>) => {
    const updated = await api.updateProject(id, data)
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)))
    return updated
  }, [])

  const deleteProject = useCallback(async (id: string) => {
    await api.deleteProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return { projects, loading, error, refetch: fetchProjects, getProject, createProject, updateProject, deleteProject }
}

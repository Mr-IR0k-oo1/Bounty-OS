'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ScanJob, CreateJobPayload, JobLogs, JobArtifacts } from '@/lib/types'
import { api } from '@/lib/api'

export function useJobs(programId?: string) {
  const [jobs, setJobs] = useState<ScanJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isPollingRef = useRef(false)

  const fetchJobs = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = programId ? await api.listProgramJobs(programId) : await api.listJobs()
      setJobs(data)
      if (isBackground) {
        setError(null)
      }
    } catch (e: any) {
      if (!isBackground) {
        setError(e.message || 'Failed to fetch jobs')
      }
    } finally {
      if (!isBackground) {
        setLoading(false)
      }
    }
  }, [programId])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Active polling: auto-refresh every 3s if any job is currently 'running' or 'queued'
  useEffect(() => {
    const hasActiveJobs = jobs.some(
      (j) => j.status === 'running' || j.status === 'queued'
    )

    if (!hasActiveJobs) return

    const interval = setInterval(() => {
      fetchJobs(true)
    }, 3000)

    return () => clearInterval(interval)
  }, [jobs, fetchJobs])

  const getJob = useCallback(async (id: string) => {
    return api.getJob(id)
  }, [])

  const createJob = useCallback(async (payload: CreateJobPayload) => {
    const created = await api.createJob(payload)
    setJobs((prev) => [created, ...prev])
    return created
  }, [])

  const cancelJob = useCallback(async (id: string) => {
    const cancelled = await api.cancelJob(id)
    setJobs((prev) => prev.map((j) => (j.id === id ? cancelled : j)))
    return cancelled
  }, [])

  const getJobLogs = useCallback(async (id: string): Promise<JobLogs> => {
    return api.getJobLogs(id)
  }, [])

  const getJobArtifacts = useCallback(async (id: string): Promise<JobArtifacts> => {
    return api.getJobArtifacts(id)
  }, [])

  return {
    jobs,
    loading,
    error,
    refetch: () => fetchJobs(false),
    getJob,
    createJob,
    cancelJob,
    getJobLogs,
    getJobArtifacts,
  }
}

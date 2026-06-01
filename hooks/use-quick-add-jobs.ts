'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CREATOR_PIPELINE_SCHEMA } from '@/lib/creator-pipeline/constants'
import {
  enqueueQuickAddUrls,
  fetchQuickAddJobs,
  confirmQuickAddJob as confirmQuickAddJobApi,
  retryQuickAddJob as retryQuickAddJobApi,
} from '@/lib/creator-outreach/client-api'
import {
  optimisticQuickAddJob,
  type QuickAddJobView,
} from '@/lib/creator-outreach/quick-add-jobs'

const AUTO_ACCEPT_STORAGE_KEY = 'creator-pipeline-quick-add-auto-accept'
const AUTO_ACCEPT_MAX_CHAIN = 25

function mergeJobsWithOptimistic(
  server: QuickAddJobView[],
  optimistic: QuickAddJobView[]
): QuickAddJobView[] {
  const serverIds = new Set(server.map((j) => j.id))
  const pendingOptimistic = optimistic.filter(
    (o) => !server.some((s) => s.url === o.url || serverIds.has(o.id))
  )
  return [...server, ...pendingOptimistic].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )
}

export function useQuickAddAutoAcceptPreference(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(AUTO_ACCEPT_STORAGE_KEY) === '1')
    } catch {
      setEnabled(false)
    }
  }, [])

  const set = useCallback((value: boolean) => {
    setEnabled(value)
    try {
      localStorage.setItem(AUTO_ACCEPT_STORAGE_KEY, value ? '1' : '0')
    } catch {
      // ignore
    }
  }, [])

  return [enabled, set]
}

export function useQuickAddJobs(currentUserId: string | null) {
  const [jobs, setJobs] = useState<QuickAddJobView[]>([])
  const [loading, setLoading] = useState(true)
  const autoAcceptInFlightRef = useRef(false)
  const optimisticRef = useRef<QuickAddJobView[]>([])

  const refreshJobs = useCallback(async () => {
    try {
      const list = await fetchQuickAddJobs()
      setJobs(mergeJobsWithOptimistic(list, optimisticRef.current))
      return list
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshJobs()
  }, [refreshJobs])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('creator-pipeline-quick-add-jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: CREATOR_PIPELINE_SCHEMA,
          table: 'quick_add_jobs',
        },
        () => {
          void refreshJobs()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refreshJobs])

  const enqueueUrl = useCallback(
    async (url: string) => {
      if (!currentUserId) throw new Error('Sign in required')
      const optimistic = optimisticQuickAddJob(url, currentUserId)
      optimisticRef.current = [...optimisticRef.current, optimistic]
      setJobs((prev) => [...prev, optimistic])
      const { jobs: added, skipped } = await enqueueQuickAddUrls(url)
      if (skipped.length > 0) {
        optimisticRef.current = optimisticRef.current.filter((j) => j.id !== optimistic.id)
        setJobs((prev) => prev.filter((j) => j.id !== optimistic.id))
        throw new Error('This URL is already in the queue.')
      }
      optimisticRef.current = optimisticRef.current.filter((j) => j.id !== optimistic.id)
      await refreshJobs()
      return added[0] ?? null
    },
    [currentUserId, refreshJobs]
  )

  const confirmJob = useCallback(
    async (
      jobId: string,
      notes: string,
      options?: { force?: boolean; allowAuto?: boolean }
    ) => {
      const result = await confirmQuickAddJobApi(jobId, notes, options)
      await refreshJobs()
      return result
    },
    [refreshJobs]
  )

  const retryJob = useCallback(
    async (jobId: string) => {
      await retryQuickAddJobApi(jobId)
      await refreshJobs()
    },
    [refreshJobs]
  )

  const pickAutoAcceptCandidate = useCallback((list: QuickAddJobView[]) => {
    return (
      list
        .filter(
          (j) =>
            j.status === 'ready' && j.autoConfirmEligible && !j.optimistic
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null
    )
  }, [])

  /** Process FIFO auto-accept chain until no eligible ready jobs remain. */
  const runAutoAccept = useCallback(
    async (
      autoAcceptEnabled: boolean,
      onConfirm: (jobId: string, notes: string) => Promise<void>
    ): Promise<number> => {
      if (!autoAcceptEnabled || autoAcceptInFlightRef.current) return 0

      autoAcceptInFlightRef.current = true
      let processed = 0

      try {
        for (let i = 0; i < AUTO_ACCEPT_MAX_CHAIN; i++) {
          const list = (await refreshJobs()) ?? []
          const candidate = pickAutoAcceptCandidate(list)
          if (!candidate) break

          await onConfirm(candidate.id, '')
          processed++
        }
      } catch {
        // stop chain on first failure
      } finally {
        autoAcceptInFlightRef.current = false
      }

      return processed
    },
    [pickAutoAcceptCandidate, refreshJobs]
  )

  return {
    jobs,
    loading,
    refreshJobs,
    enqueueUrl,
    confirmJob,
    retryJob,
    runAutoAccept,
    pickAutoAcceptCandidate,
  }
}

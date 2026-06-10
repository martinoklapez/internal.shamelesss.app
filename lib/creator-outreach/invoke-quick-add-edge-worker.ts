import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProcessQuickAddJobsResult } from '@/lib/database/creator-pipeline/process-quick-add-scrape'
import { processPendingQuickAddJobs } from '@/lib/database/creator-pipeline/process-quick-add-scrape'
import { edgeWorkerInvokeHeaders } from '@/lib/creator-outreach/edge-worker-invoke-headers'
import { readRuntimeEnv } from '@/lib/runtime/env'

/**
 * Run the Quick Add scrape worker on Supabase Edge (preferred).
 * Falls back to in-process Vercel worker only when explicitly enabled or in development.
 */
export async function invokeQuickAddEdgeWorker(
  supabase: SupabaseClient
): Promise<ProcessQuickAddJobsResult | undefined> {
  const { data, error } = await supabase.functions.invoke('process-creator-quick-add', {
    body: {},
    headers: edgeWorkerInvokeHeaders(),
  })

  if (!error) {
    return data as ProcessQuickAddJobsResult
  }

  const allowFallback =
    readRuntimeEnv('QUICK_ADD_VERCEL_WORKER_FALLBACK') === 'true' ||
    readRuntimeEnv('NODE_ENV') === 'development'

  if (allowFallback) {
    console.warn(
      'Edge quick-add worker invoke failed; running local fallback:',
      error.message
    )
    return processPendingQuickAddJobs(supabase)
  }

  console.error('Edge quick-add worker invoke failed:', error.message)
  return undefined
}

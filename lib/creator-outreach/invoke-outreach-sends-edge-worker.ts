import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProcessOutreachSendsResult } from '@/lib/database/creator-pipeline/process-outreach-sends'
import { edgeWorkerInvokeHeaders } from '@/lib/creator-outreach/edge-worker-invoke-headers'

/**
 * Send queued outreach emails on Supabase Edge (Missive runs only on Edge).
 */
export async function invokeOutreachSendsEdgeWorker(
  supabase: SupabaseClient
): Promise<ProcessOutreachSendsResult | undefined> {
  const { data, error } = await supabase.functions.invoke('process-creator-outreach-sends', {
    body: {},
    headers: edgeWorkerInvokeHeaders(),
  })

  if (!error) {
    return data as ProcessOutreachSendsResult
  }

  console.error('Edge outreach send worker invoke failed:', error.message)
  return undefined
}

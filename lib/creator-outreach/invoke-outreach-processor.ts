import type { SupabaseClient } from '@supabase/supabase-js'
import { processPendingOutreachEvents } from '@/lib/database/creator-pipeline/process-outreach-events'
import { invokeOutreachSendsEdgeWorker } from '@/lib/creator-outreach/invoke-outreach-sends-edge-worker'
import type { EvaluateOutreachResult } from './rules-engine'

/**
 * Queue outreach from pending events on Vercel; trigger Edge send worker (async).
 */
export async function invokeOutreachProcessor(
  supabase: SupabaseClient,
  options?: { contactIds?: string[] }
): Promise<{
  outreach?: EvaluateOutreachResult
  processed: number
}> {
  const result = await processPendingOutreachEvents(supabase, {
    contactIds: options?.contactIds,
  })

  void invokeOutreachSendsEdgeWorker(supabase).catch((err) => {
    console.error('invokeOutreachSendsEdgeWorker after queue:', err)
  })

  return {
    outreach: result.lastOutreach,
    processed: result.processed,
  }
}

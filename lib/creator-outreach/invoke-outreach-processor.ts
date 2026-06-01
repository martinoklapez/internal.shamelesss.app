import type { SupabaseClient } from '@supabase/supabase-js'
import {
  processPendingOutreachEvents,
  type ProcessOutreachEventsResult,
} from '@/lib/database/creator-pipeline/process-outreach-events'
import type { EvaluateOutreachResult } from './rules-engine'

/**
 * Process outreach events after contacts are persisted.
 * Uses in-process worker (same logic as POST /api/creator-pipeline/process-outreach).
 */
export async function invokeOutreachProcessor(
  supabase: SupabaseClient,
  options?: { contactIds?: string[]; attemptMissive?: boolean }
): Promise<{
  outreach?: EvaluateOutreachResult
  processed: number
  missiveSent?: number
  missiveFailed?: number
  lastMissiveError?: string
}> {
  const attemptMissive =
    options?.attemptMissive ??
    Boolean(process.env.MISSIVE_API_TOKEN?.trim() && process.env.MISSIVE_FROM_ADDRESS?.trim())

  const result: ProcessOutreachEventsResult = await processPendingOutreachEvents(
    supabase,
    {
      contactIds: options?.contactIds,
      attemptMissive,
    }
  )
  return {
    outreach: result.lastOutreach,
    processed: result.processed,
    missiveSent: result.missiveSent,
    missiveFailed: result.missiveFailed,
    lastMissiveError: result.lastMissiveError,
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  processPendingQuickAddJobs,
  type ProcessQuickAddJobsResult,
} from '@/lib/database/creator-pipeline/process-quick-add-jobs'

/**
 * Drain pending quick-add scrape jobs (same logic as POST /api/creator-pipeline/process-quick-add).
 */
export async function invokeQuickAddProcessor(
  supabase: SupabaseClient,
  options?: { limit?: number }
): Promise<ProcessQuickAddJobsResult> {
  return processPendingQuickAddJobs(supabase, options)
}

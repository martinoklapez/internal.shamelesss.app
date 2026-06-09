import type { SupabaseClient } from '@supabase/supabase-js'
import {
  processPendingQuickAddJobs,
  type ProcessQuickAddJobsResult,
} from '@/lib/database/creator-pipeline/process-quick-add-scrape'

/**
 * Drain pending quick-add scrape jobs in-process on Vercel (dev / fallback).
 * Production enqueue uses {@link invokeQuickAddEdgeWorker} → Supabase Edge Function.
 */
export async function invokeQuickAddProcessor(
  supabase: SupabaseClient,
  options?: { limit?: number }
): Promise<ProcessQuickAddJobsResult> {
  return processPendingQuickAddJobs(supabase, options)
}

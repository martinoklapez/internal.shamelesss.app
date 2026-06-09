import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResolvedSocialProfile } from '@/lib/social-profile-url'
import { resolveSocialProfileFromUrl } from '@/lib/social-profile-url'
import { readRuntimeEnv } from '@/lib/runtime/env'
import { creatorPipelineDb } from './client'
import type { QuickAddJobRow } from './quick-add-job-rows'
import { syncReadyQuickAddJobPlans } from './quick-add-plan-sync'

function workerBatchSize(): number {
  const raw = readRuntimeEnv('QUICK_ADD_WORKER_BATCH_SIZE')
  const n = raw ? Number(raw) : 3
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 10) : 3
}

async function claimPendingJobs(
  db: ReturnType<typeof creatorPipelineDb>,
  limit: number
): Promise<QuickAddJobRow[]> {
  const { data, error } = await db
    .from('quick_add_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Failed to load quick add jobs: ${error.message}`)

  const rows = (data ?? []) as QuickAddJobRow[]
  const claimed: QuickAddJobRow[] = []

  for (const row of rows) {
    const { data: updated, error: claimError } = await db
      .from('quick_add_jobs')
      .update({
        status: 'scraping',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle()

    if (claimError) {
      throw new Error(`Failed to claim quick add job: ${claimError.message}`)
    }
    if (updated) claimed.push(updated as QuickAddJobRow)
  }

  return claimed
}

async function scrapeJob(
  supabase: SupabaseClient,
  db: ReturnType<typeof creatorPipelineDb>,
  row: QuickAddJobRow
): Promise<void> {
  try {
    const resolved = await resolveSocialProfileFromUrl(row.url)
    if (!resolved) {
      throw new Error('Could not resolve profile from URL.')
    }

    const now = new Date().toISOString()
    const { error } = await db
      .from('quick_add_jobs')
      .update({
        status: 'ready',
        resolved_payload: resolved,
        error_message: null,
        scraped_at: now,
        updated_at: now,
      })
      .eq('id', row.id)
      .eq('status', 'scraping')

    if (error) throw new Error(error.message)

    await syncReadyQuickAddJobPlans(supabase)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scrape failed'
    await db
      .from('quick_add_jobs')
      .update({
        status: 'failed',
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
  }
}

async function tallyScrapeResults(
  db: ReturnType<typeof creatorPipelineDb>,
  row: QuickAddJobRow
): Promise<'ready' | 'failed'> {
  const { data } = await db.from('quick_add_jobs').select('status').eq('id', row.id).maybeSingle()
  return (data as { status: string } | null)?.status === 'ready' ? 'ready' : 'failed'
}

export type ProcessQuickAddJobsResult = {
  claimed: number
  ready: number
  failed: number
}

/** Drain pending quick-add jobs (Apify scrape + plan). Safe for Supabase Edge bundle. */
export async function processPendingQuickAddJobs(
  supabase: SupabaseClient,
  options?: { limit?: number; sequential?: boolean }
): Promise<ProcessQuickAddJobsResult> {
  const db = creatorPipelineDb(supabase)
  const limit = options?.limit ?? workerBatchSize()
  const claimed = await claimPendingJobs(db, limit)

  let ready = 0
  let failed = 0

  const runOne = async (row: QuickAddJobRow) => {
    await scrapeJob(supabase, db, row)
    if (await tallyScrapeResults(db, row) === 'ready') ready++
    else failed++
  }

  if (options?.sequential) {
    for (const row of claimed) {
      await runOne(row)
    }
  } else {
    await Promise.all(claimed.map(runOne))
  }

  if (claimed.length > 0) {
    await syncReadyQuickAddJobPlans(supabase)
  }

  return { claimed: claimed.length, ready, failed }
}

export type { ResolvedSocialProfile }

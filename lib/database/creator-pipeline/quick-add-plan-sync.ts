import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assessQuickAddFromRow,
  quickAddJobRowToPeer,
} from '@/lib/creator-outreach/quick-add-integrity'
import { serializeQuickAddPlan } from '@/lib/creator-outreach/quick-add-jobs'
import type { ResolvedSocialProfile } from '@/lib/social-profile-url'
import { loadCreatorOutreachStoreFromDb } from './load-store'
import { creatorPipelineDb } from './client'
import type { QuickAddJobRow } from './quick-add-job-rows'

const ACTIVE_STATUSES = ['pending', 'scraping', 'ready', 'confirming', 'failed'] as const

export async function loadQuickAddJobRows(
  supabase: SupabaseClient,
  options?: { includeRecentReadyHours?: number }
): Promise<QuickAddJobRow[]> {
  const db = creatorPipelineDb(supabase)
  const { data: active, error } = await db
    .from('quick_add_jobs')
    .select('*')
    .in('status', [...ACTIVE_STATUSES])
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to load quick add jobs: ${error.message}`)

  const rows = (active ?? []) as QuickAddJobRow[]
  const hours = options?.includeRecentReadyHours ?? 72
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const { data: recentReady, error: recentError } = await db
    .from('quick_add_jobs')
    .select('*')
    .eq('status', 'ready')
    .gte('scraped_at', since)
    .order('created_at', { ascending: true })

  if (recentError) {
    throw new Error(`Failed to load recent ready jobs: ${recentError.message}`)
  }

  const byId = new Map<string, QuickAddJobRow>()
  for (const row of rows) byId.set(row.id, row)
  for (const row of (recentReady ?? []) as QuickAddJobRow[]) {
    if (!byId.has(row.id)) byId.set(row.id, row)
  }

  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/** Recompute plan + integrity for all ready jobs (queue-aware). */
export async function syncReadyQuickAddJobPlans(
  supabase: SupabaseClient
): Promise<void> {
  const db = creatorPipelineDb(supabase)
  const allRows = await loadQuickAddJobRows(supabase)
  const store = await loadCreatorOutreachStoreFromDb(supabase)

  for (const row of allRows) {
    if (row.status !== 'ready') continue
    const assessment = assessQuickAddFromRow(store, allRows, row)
    if (!assessment) continue

    await db
      .from('quick_add_jobs')
      .update({
        plan_payload: serializeQuickAddPlan(assessment.plan) as Record<string, unknown>,
        review_required: assessment.reviewRequired,
        auto_confirm_eligible: assessment.autoConfirmEligible,
        plan_warnings: assessment.warnings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'ready')
  }
}

export async function applyIntegrityToRow(
  supabase: SupabaseClient,
  row: QuickAddJobRow,
  allRows?: QuickAddJobRow[]
): Promise<QuickAddJobRow> {
  const rows = allRows ?? (await loadQuickAddJobRows(supabase))
  const store = await loadCreatorOutreachStoreFromDb(supabase)
  const assessment = assessQuickAddFromRow(store, rows, row)
  if (!assessment) return row

  return {
    ...row,
    plan_payload: serializeQuickAddPlan(assessment.plan) as Record<string, unknown>,
    review_required: assessment.reviewRequired,
    auto_confirm_eligible: assessment.autoConfirmEligible,
    plan_warnings: assessment.warnings as QuickAddJobRow['plan_warnings'],
  }
}

export function peersFromRows(rows: QuickAddJobRow[]) {
  return rows.map(quickAddJobRowToPeer)
}

export type { ResolvedSocialProfile }

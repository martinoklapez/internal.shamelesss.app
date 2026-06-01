import type { SupabaseClient } from '@supabase/supabase-js'
import { quickAddProfile, type QuickAddPlan } from '@/lib/creator-outreach/quick-add'
import {
  assessQuickAddJob,
  plansMateriallyDiffer,
  quickAddJobRowToPeer,
} from '@/lib/creator-outreach/quick-add-integrity'
import { invokeOutreachProcessor } from '@/lib/creator-outreach/invoke-outreach-processor'
import type { ResolvedSocialProfile } from '@/lib/social-profile-url'
import { resolveSocialProfileFromUrl } from '@/lib/social-profile-url'
import {
  mapQuickAddJobRow,
  normalizeQuickAddJobUrl,
  serializeQuickAddPlan,
  type QuickAddJobView,
} from '@/lib/creator-outreach/quick-add-jobs'
import { loadCreatorOutreachStoreFromDb } from './load-store'
import { persistCreatorOutreachStoreToDb } from './persist-store'
import { creatorPipelineDb } from './client'
import type { QuickAddJobRow } from './quick-add-job-rows'
import { downloadAndUploadProfileAvatar } from './upload-profile-avatar'
import { updateProfile } from '@/lib/creator-outreach/store'
import {
  applyIntegrityToRow,
  loadQuickAddJobRows,
  syncReadyQuickAddJobPlans,
} from './quick-add-plan-sync'

function workerBatchSize(): number {
  const raw = process.env.QUICK_ADD_WORKER_BATCH_SIZE?.trim()
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

export type ProcessQuickAddJobsResult = {
  claimed: number
  ready: number
  failed: number
}

/** Drain pending quick-add jobs (Apify scrape + plan). */
export async function processPendingQuickAddJobs(
  supabase: SupabaseClient,
  options?: { limit?: number }
): Promise<ProcessQuickAddJobsResult> {
  const db = creatorPipelineDb(supabase)
  const limit = options?.limit ?? workerBatchSize()
  const claimed = await claimPendingJobs(db, limit)

  let ready = 0
  let failed = 0

  await Promise.all(
    claimed.map(async (row) => {
      await scrapeJob(supabase, db, row)
      const { data } = await db.from('quick_add_jobs').select('status').eq('id', row.id).maybeSingle()
      if ((data as { status: string } | null)?.status === 'ready') ready++
      else failed++
    })
  )

  if (claimed.length > 0) {
    await syncReadyQuickAddJobPlans(supabase)
  }

  return { claimed: claimed.length, ready, failed }
}

export async function enqueueQuickAddJobs(
  supabase: SupabaseClient,
  userId: string,
  urls: string[]
): Promise<{ jobs: QuickAddJobView[]; skipped: string[] }> {
  const db = creatorPipelineDb(supabase)
  const jobs: QuickAddJobView[] = []
  const skipped: string[] = []

  for (const rawUrl of urls) {
    const url = rawUrl.trim()
    if (!url) continue
    const normalized = normalizeQuickAddJobUrl(url)

    const { data: existing } = await db
      .from('quick_add_jobs')
      .select('id')
      .eq('url_normalized', normalized)
      .in('status', ['pending', 'scraping', 'ready', 'confirming'])
      .maybeSingle()

    if (existing) {
      skipped.push(url)
      continue
    }

    const { data, error } = await db
      .from('quick_add_jobs')
      .insert({
        created_by: userId,
        url,
        url_normalized: normalized,
        status: 'pending',
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        skipped.push(url)
        continue
      }
      throw new Error(`Failed to enqueue quick add job: ${error.message}`)
    }

    jobs.push(mapQuickAddJobRow(data as QuickAddJobRow))
  }

  return { jobs, skipped }
}

export async function listActiveQuickAddJobs(
  supabase: SupabaseClient
): Promise<QuickAddJobView[]> {
  const rows = await loadQuickAddJobRows(supabase, { includeRecentReadyHours: 72 })
  const store = await loadCreatorOutreachStoreFromDb(supabase)

  return rows.map((row) => {
    const view = mapQuickAddJobRow(row)
    if (row.status !== 'ready' || !row.resolved_payload) return view
    const assessment = assessQuickAddJob(
      store,
      rows.map(quickAddJobRowToPeer),
      row.id,
      {
        platform: (row.resolved_payload as ResolvedSocialProfile).platform,
        handle: (row.resolved_payload as ResolvedSocialProfile).username,
        displayName:
          (row.resolved_payload as ResolvedSocialProfile).name.trim() ||
          (row.resolved_payload as ResolvedSocialProfile).username,
        draftContact: (row.resolved_payload as ResolvedSocialProfile).draftContact,
      },
      { storedPlan: (row.plan_payload as QuickAddPlan | null) ?? null }
    )
    return {
      ...view,
      plan: assessment.plan,
      reviewRequired: assessment.reviewRequired,
      autoConfirmEligible: assessment.autoConfirmEligible,
      warnings: assessment.warnings,
      fifoPosition: assessment.fifoPosition,
      readyAhead: assessment.readyAhead,
    }
  })
}

export async function retryQuickAddJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<QuickAddJobView> {
  const db = creatorPipelineDb(supabase)
  const { data, error } = await db
    .from('quick_add_jobs')
    .update({
      status: 'pending',
      error_message: null,
      resolved_payload: null,
      plan_payload: null,
      scraped_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', 'failed')
    .select('*')
    .maybeSingle()

  if (error || !data) {
    throw new Error(error?.message ?? 'Job not found or not failed')
  }
  return mapQuickAddJobRow(data as QuickAddJobRow)
}

export async function confirmQuickAddJob(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
  notes: string,
  options?: { force?: boolean; allowAuto?: boolean }
): Promise<{
  store: Awaited<ReturnType<typeof loadCreatorOutreachStoreFromDb>>
  job: QuickAddJobView
  outreach?: import('@/lib/creator-outreach/rules-engine').EvaluateOutreachResult
  missiveSent?: number
  missiveFailed?: number
  lastMissiveError?: string
}> {
  const db = creatorPipelineDb(supabase)

  const { data: row, error: loadError } = await db
    .from('quick_add_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle()

  if (loadError || !row) {
    throw new Error(loadError?.message ?? 'Quick add job not found')
  }

  const jobRow = row as QuickAddJobRow
  if (jobRow.status !== 'ready') {
    throw new Error(`Job is not ready to confirm (status: ${jobRow.status})`)
  }

  const resolved = jobRow.resolved_payload as ResolvedSocialProfile | null
  if (!resolved) {
    throw new Error('Job has no scraped profile data')
  }

  const allRows = await loadQuickAddJobRows(supabase)
  const peers = allRows.map(quickAddJobRowToPeer)
  const readyOrdered = peers
    .filter((p) => p.status === 'ready')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const persisted = await loadCreatorOutreachStoreFromDb(supabase)
  const assessment = assessQuickAddJob(
    persisted,
    peers,
    jobId,
    {
      platform: resolved.platform,
      handle: resolved.username,
      displayName: resolved.name.trim() || resolved.username,
      draftContact: resolved.draftContact,
    },
    { storedPlan: (jobRow.plan_payload as QuickAddPlan | null) ?? null }
  )

  const firstReady = readyOrdered[0]
  if (
    firstReady &&
    firstReady.jobId !== jobId &&
    !options?.force &&
    !(options?.allowAuto && assessment.autoConfirmEligible)
  ) {
    throw new Error(
      'Confirm profiles in queue order. The oldest ready profile should be reviewed first.'
    )
  }

  if (assessment.warnings.some((w) => w.severity === 'block') && !options?.force) {
    throw new Error(assessment.warnings.find((w) => w.severity === 'block')!.message)
  }

  if (options?.allowAuto && !assessment.autoConfirmEligible && !options?.force) {
    throw new Error(
      'Auto-accept skipped — resolve queue conflicts first or confirm manually.'
    )
  }

  if (
    !options?.force &&
    jobRow.plan_payload &&
    plansMateriallyDiffer(assessment.plan, jobRow.plan_payload as QuickAddPlan)
  ) {
    throw new Error('Plan changed — review the updated match plan before confirming.')
  }

  const { error: claimError } = await db
    .from('quick_add_jobs')
    .update({
      status: 'confirming',
      notes: notes.trim(),
      confirmed_by: userId,
      plan_payload: serializeQuickAddPlan(assessment.plan) as Record<string, unknown>,
      review_required: assessment.reviewRequired,
      auto_confirm_eligible: assessment.autoConfirmEligible,
      plan_warnings: assessment.warnings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', 'ready')

  if (claimError) throw new Error(claimError.message)

  try {
    const store = structuredClone(persisted)
    const plan = assessment.plan

    const result = quickAddProfile(store, {
      platform: resolved.platform,
      handle: resolved.username,
      displayName: resolved.name.trim() || resolved.username,
      profileUrl: resolved.profileUrl,
      profilePictureSourceUrl: resolved.profilePicture,
      followerCount: resolved.followerCount,
      notes: notes.trim(),
      draftContact: resolved.draftContact,
      plan,
      scoutedBy: userId,
    })

    Object.assign(store, result.store)

    const sourceUrl = resolved.profilePicture?.trim()
    if (sourceUrl) {
      const avatarUrl = await downloadAndUploadProfileAvatar(result.profile.id, sourceUrl)
      if (avatarUrl) {
        updateProfile(store, result.profile.id, { avatarUrl })
      }
    }

    await persistCreatorOutreachStoreToDb(supabase, store)

    let outreach: import('@/lib/creator-outreach/rules-engine').EvaluateOutreachResult | undefined
    let missiveSent: number | undefined
    let missiveFailed: number | undefined
    let lastMissiveError: string | undefined

    if (result.emailReadyContactId) {
      const processed = await invokeOutreachProcessor(supabase, {
        contactIds: [result.emailReadyContactId],
      })
      outreach = processed.outreach
      missiveSent = processed.missiveSent
      missiveFailed = processed.missiveFailed
      lastMissiveError = processed.lastMissiveError
    }

    const now = new Date().toISOString()
    const contactId = result.contactFromDraft?.id ?? null
    const { data: completed, error: completeError } = await db
      .from('quick_add_jobs')
      .update({
        status: 'completed',
        result_profile_id: result.profile.id,
        result_creator_id: result.profile.creatorId,
        result_contact_id: contactId,
        completed_at: now,
        updated_at: now,
        error_message: null,
      })
      .eq('id', jobId)
      .select('*')
      .single()

    if (completeError) throw new Error(completeError.message)

    await syncReadyQuickAddJobPlans(supabase)

    const saved = await loadCreatorOutreachStoreFromDb(supabase)

    return {
      store: saved,
      job: mapQuickAddJobRow(completed as QuickAddJobRow),
      outreach,
      missiveSent,
      missiveFailed,
      lastMissiveError,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Confirm failed'
    await db
      .from('quick_add_jobs')
      .update({
        status: 'failed',
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    throw err
  }
}

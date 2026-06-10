import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyContactEmailReadyRules,
  type EvaluateOutreachResult,
} from '@/lib/creator-outreach/rules-engine'
import { loadCreatorOutreachStoreFromDb } from './load-store'
import { persistCreatorOutreachStoreToDb } from './persist-store'
import { creatorPipelineDb } from './client'
import type { OutreachEventRow } from './rows'

export type ProcessOutreachEventsOptions = {
  limit?: number
  contactIds?: string[]
}

export type ProcessOutreachEventsResult = {
  processed: number
  failed: number
  lastOutreach?: EvaluateOutreachResult
  queuedSendIds: string[]
}

function serializeResult(result: EvaluateOutreachResult): Record<string, unknown> {
  if (result.action === 'queued') {
    return {
      action: result.action,
      sendId: result.send.id,
      email: result.send.email,
      templateName: result.send.templateName,
    }
  }
  return { action: result.action, reason: result.reason }
}

async function claimPendingEvents(
  db: ReturnType<typeof creatorPipelineDb>,
  options: ProcessOutreachEventsOptions
): Promise<OutreachEventRow[]> {
  let query = db
    .from('outreach_events')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(options.limit ?? 50)

  if (options.contactIds?.length) {
    query = query.in('contact_id', options.contactIds)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to load outreach events: ${error.message}`)
  }

  const rows = (data ?? []) as OutreachEventRow[]
  const claimed: OutreachEventRow[] = []

  for (const row of rows) {
    const { data: updated, error: claimError } = await db
      .from('outreach_events')
      .update({ status: 'processing' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle()

    if (claimError) {
      throw new Error(`Failed to claim outreach event: ${claimError.message}`)
    }
    if (updated) {
      claimed.push(updated as OutreachEventRow)
    }
  }

  return claimed
}

/**
 * Process pending outreach_events (from DB trigger on contacts.email).
 * Applies outreach_rules and queues outreach_sends — Missive send runs on Edge.
 */
export async function processPendingOutreachEvents(
  supabase: SupabaseClient,
  options: ProcessOutreachEventsOptions = {}
): Promise<ProcessOutreachEventsResult> {
  const db = creatorPipelineDb(supabase)
  const events = await claimPendingEvents(db, options)

  let processed = 0
  let failed = 0
  let lastOutreach: EvaluateOutreachResult | undefined
  const queuedSendIds: string[] = []

  for (const event of events) {
    try {
      const store = await loadCreatorOutreachStoreFromDb(supabase)
      const result = applyContactEmailReadyRules(store, store.outreachRules, {
        contactId: event.contact_id,
      })
      await persistCreatorOutreachStoreToDb(supabase, store)

      if (result.action === 'queued') {
        queuedSendIds.push(result.send.id)
      }

      lastOutreach = result

      const { error: completeError } = await db
        .from('outreach_events')
        .update({
          status: 'completed',
          result: serializeResult(result),
          processed_at: new Date().toISOString(),
        })
        .eq('id', event.id)

      if (completeError) {
        throw new Error(completeError.message)
      }
      processed += 1
    } catch (err) {
      failed += 1
      const message = err instanceof Error ? err.message : 'Processing failed'
      await db
        .from('outreach_events')
        .update({
          status: 'failed',
          error_message: message,
          processed_at: new Date().toISOString(),
        })
        .eq('id', event.id)
    }
  }

  return {
    processed,
    failed,
    lastOutreach,
    queuedSendIds,
  }
}

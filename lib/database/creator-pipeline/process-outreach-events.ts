import type { SupabaseClient } from '@supabase/supabase-js'
import { sendQueuedOutreachViaMissive } from '@/lib/creator-outreach/missive'
import { platformLabel } from '@/lib/creator-outreach/store'
import {
  applyContactEmailReadyRules,
  markOutreachSendDelivered,
  type EvaluateOutreachResult,
} from '@/lib/creator-outreach/rules-engine'
import { loadCreatorOutreachStoreFromDb } from './load-store'
import { persistCreatorOutreachStoreToDb } from './persist-store'
import { creatorPipelineDb } from './client'
import type { OutreachEventRow } from './rows'

function shouldAttemptMissive(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit
  return Boolean(process.env.MISSIVE_API_TOKEN?.trim() && process.env.MISSIVE_FROM_ADDRESS?.trim())
}

export type ProcessOutreachEventsOptions = {
  limit?: number
  contactIds?: string[]
  /** Attempt Missive send for rows queued in this run (no-op until implemented). */
  attemptMissive?: boolean
}

export type ProcessOutreachEventsResult = {
  processed: number
  failed: number
  lastOutreach?: EvaluateOutreachResult
  missiveSent?: number
  missiveFailed?: number
  lastMissiveError?: string
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

async function processMissiveForQueuedSends(
  supabase: SupabaseClient,
  sendIds: string[]
): Promise<{ sent: number; failed: number; lastError?: string }> {
  if (sendIds.length === 0) return { sent: 0, failed: 0 }

  const store = await loadCreatorOutreachStoreFromDb(supabase)
  const templateById = new Map(store.templates.map((t) => [t.id, t]))
  let sent = 0
  let failed = 0
  let lastError: string | undefined

  for (const sendId of sendIds) {
    const send = store.outreachSends.find((s) => s.id === sendId)
    if (!send || send.status !== 'queued') continue

    const tpl = templateById.get(send.templateId)
    if (!tpl) {
      failed += 1
      lastError = `Template not found for send ${sendId}`
      continue
    }

    const contact = send.contactId
      ? store.contacts.find((c) => c.id === send.contactId)
      : undefined
    const creator = send.creatorId
      ? store.creators.find((c) => c.id === send.creatorId)
      : contact?.creatorId
        ? store.creators.find((c) => c.id === contact.creatorId)
        : undefined
    const profile =
      send.profileId != null
        ? store.profiles.find((p) => p.id === send.profileId)
        : contact?.creatorId
          ? store.profiles.find((p) => p.creatorId === contact.creatorId)
          : undefined

    const missive = await sendQueuedOutreachViaMissive(send, tpl, {
      contactName: contact?.name ?? send.email,
      creatorName: creator?.displayName ?? contact?.name ?? 'Creator',
      platform: profile ? platformLabel(profile.platform) : undefined,
      handle: profile?.handle,
      existingConversationId:
        contact?.missiveConversationIds[contact.missiveConversationIds.length - 1] ?? null,
    })

    if (!missive.ok) {
      failed += 1
      lastError = missive.reason
      console.error(`Missive send failed for ${send.email}:`, missive.reason)
      continue
    }

    markOutreachSendDelivered(store, send, missive.conversationId, contact ?? null)
    sent += 1
  }

  if (sent > 0 || failed > 0) {
    await persistCreatorOutreachStoreToDb(supabase, store)
  }

  return { sent, failed, lastError }
}

/**
 * Process pending outreach_events (from DB trigger on contacts.email).
 * Applies outreach_rules and persists outreach_sends / activity / CRM updates.
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

  let missiveSent = 0
  let missiveFailed = 0
  let lastMissiveError: string | undefined

  const attemptMissive = shouldAttemptMissive(options.attemptMissive)
  if (attemptMissive) {
    const store = await loadCreatorOutreachStoreFromDb(supabase)
    const allQueuedIds = store.outreachSends
      .filter((s) => s.status === 'queued')
      .map((s) => s.id)
    const sendIds = [...new Set([...queuedSendIds, ...allQueuedIds])]
    if (sendIds.length > 0) {
      const missive = await processMissiveForQueuedSends(supabase, sendIds)
      missiveSent = missive.sent
      missiveFailed = missive.failed
      lastMissiveError = missive.lastError
    }
  }

  return { processed, failed, lastOutreach, missiveSent, missiveFailed, lastMissiveError }
}

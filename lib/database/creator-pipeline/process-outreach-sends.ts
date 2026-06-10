import type { SupabaseClient } from '@supabase/supabase-js'
import { bookingDetailsFromSender } from '@/lib/creator-outreach/cal-booking'
import { sendQueuedOutreachViaMissive } from '@/lib/creator-outreach/missive'
import { defaultSendFromAddress } from '@/lib/creator-outreach/resolve-send-from'
import { platformLabel } from '@/lib/creator-outreach/store'
import { markOutreachSendDelivered } from '@/lib/creator-outreach/rules-engine'
import { readRuntimeEnv } from '@/lib/runtime/env'
import { loadCreatorOutreachStoreFromDb } from './load-store'
import { persistCreatorOutreachStoreToDb } from './persist-store'

function senderBatchSize(): number {
  const raw = readRuntimeEnv('OUTREACH_SEND_BATCH_SIZE')
  const n = raw ? Number(raw) : 5
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 20) : 5
}

export type ProcessOutreachSendsResult = {
  claimed: number
  sent: number
  failed: number
  lastError?: string
  lastWarning?: string
}

async function processMissiveForSendIds(
  supabase: SupabaseClient,
  sendIds: string[]
): Promise<{ sent: number; failed: number; lastError?: string; lastWarning?: string }> {
  if (sendIds.length === 0) return { sent: 0, failed: 0 }

  const store = await loadCreatorOutreachStoreFromDb(supabase)
  const templateById = new Map(store.templates.map((t) => [t.id, t]))
  let sent = 0
  let failed = 0
  let lastError: string | undefined
  let lastWarning: string | undefined

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

    const defaultFrom = defaultSendFromAddress(store)
    const ruleFromAddress = send.fromAddress || defaultFrom?.address
    const ruleFromDisplayName = send.fromDisplayName || defaultFrom?.displayName
    const ruleSender = store.sendFromAddresses.find(
      (s) => s.address.toLowerCase() === (ruleFromAddress ?? '').toLowerCase()
    )
    const missiveAccountId =
      ruleSender?.missiveAccountId ?? defaultFrom?.missiveAccountId
    const signatureHtml = ruleSender?.signatureHtml ?? defaultFrom?.signatureHtml
    if (!ruleFromAddress) {
      failed += 1
      lastError = 'No send-from address on queued outreach'
      continue
    }

    const missiveContext = {
      contactName: contact?.name ?? send.email,
      creatorName: creator?.displayName ?? contact?.name ?? 'Creator',
      platform: profile ? platformLabel(profile.platform) : undefined,
      handle: profile?.handle,
      existingConversationId:
        contact?.missiveConversationIds[contact.missiveConversationIds.length - 1] ?? null,
    }

    const pipelineSenders = store.sendFromAddresses
      .filter((s) => s.enabled)
      .map((s) => ({
        address: s.address,
        missiveAccountId: s.missiveAccountId,
        displayName: s.displayName,
        signatureHtml: s.signatureHtml,
      }))

    const missive = await sendQueuedOutreachViaMissive(send, tpl, {
      ...missiveContext,
      fromAddress: ruleFromAddress,
      fromDisplayName: ruleFromDisplayName,
      pipelineSenders,
      missiveAccountId,
      signatureHtml,
      bookingDetails: bookingDetailsFromSender({
        displayName: ruleFromDisplayName ?? '',
        hostAvatarUrl: ruleSender?.hostAvatarUrl,
        bookingUrl: ruleSender?.bookingUrl,
        bookingMeetingName: ruleSender?.bookingMeetingName,
        bookingMeetingType: ruleSender?.bookingMeetingType,
        bookingDuration: ruleSender?.bookingDuration,
        bookingActionLabel: ruleSender?.bookingActionLabel,
      }),
    })

    if (!missive.ok) {
      failed += 1
      lastError = missive.reason
      console.error(`Missive send failed for ${send.email}:`, missive.reason)
      continue
    }

    if (missive.personalFallback) {
      const matched = store.sendFromAddresses.find(
        (s) => s.address.toLowerCase() === missive.fromAddress.toLowerCase()
      )
      send.fromAddress = missive.fromAddress
      send.fromDisplayName = matched?.displayName ?? send.fromDisplayName
      lastWarning =
        `Email sent from ${missive.fromAddress} (API token user), not ${missive.configuredFromAddress}. ` +
        `Enable "Allow others to send" on that alias in Missive for API sends from the shared inbox.`
    }

    markOutreachSendDelivered(store, send, missive.conversationId, contact ?? null)
    sent += 1
  }

  if (sent > 0 || failed > 0) {
    await persistCreatorOutreachStoreToDb(supabase, store)
  }

  return { sent, failed, lastError, lastWarning }
}

/** Drain queued outreach_sends via Missive (Supabase Edge worker). */
export async function processQueuedOutreachSends(
  supabase: SupabaseClient,
  options?: { limit?: number; sendIds?: string[] }
): Promise<ProcessOutreachSendsResult> {
  const limit = options?.limit ?? senderBatchSize()
  let sendIds = options?.sendIds

  if (!sendIds) {
    const store = await loadCreatorOutreachStoreFromDb(supabase)
    sendIds = store.outreachSends
      .filter((s) => s.status === 'queued')
      .slice(0, limit)
      .map((s) => s.id)
  } else {
    sendIds = sendIds.slice(0, limit)
  }

  const result = await processMissiveForSendIds(supabase, sendIds)
  return {
    claimed: sendIds.length,
    sent: result.sent,
    failed: result.failed,
    lastError: result.lastError,
    lastWarning: result.lastWarning,
  }
}

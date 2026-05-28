import type { SupabaseClient } from '@supabase/supabase-js'
import type { CreatorOutreachStore } from '@/lib/creator-outreach/types'
import { creatorPipelineDb } from './client'
import {
  buildAssociationRows,
  contactToRow,
  creatorToRow,
  mapActivityRow,
  mapOutreachSendRow,
  mapTemplateRow,
  mapTouchpointRow,
} from './mappers'

function templateToRow(t: CreatorOutreachStore['templates'][0]) {
  return {
    id: t.id,
    name: t.name,
    subject: t.subject,
    body_preview: t.bodyPreview,
    is_default: t.isDefault,
  }
}

function touchpointToRow(t: CreatorOutreachStore['emailTouchpoints'][0]) {
  return {
    id: t.id,
    email: t.email,
    profile_id: t.profileId,
    contact_id: t.contactId,
    creator_id: t.creatorId,
    added_at: t.addedAt,
  }
}

function outreachSendToRow(s: CreatorOutreachStore['outreachSends'][0]) {
  return {
    id: s.id,
    email: s.email,
    template_id: s.templateId,
    template_name: s.templateName,
    profile_id: s.profileId,
    contact_id: s.contactId,
    creator_id: s.creatorId,
    status: s.status,
    sent_at: s.sentAt,
  }
}

function activityToRow(e: CreatorOutreachStore['activity'][0]) {
  return {
    id: e.id,
    type: e.type,
    message: e.message,
    created_at: e.createdAt,
  }
}

/** Upsert full in-memory store snapshot (used after pipeline mutations). */
export async function persistCreatorOutreachStoreToDb(
  supabase: SupabaseClient,
  store: CreatorOutreachStore
): Promise<void> {
  const db = creatorPipelineDb(supabase)

  const creatorRows = store.creators.map(creatorToRow)
  const profileRows = store.profiles.map((p) => ({
    id: p.id,
    platform: p.platform,
    handle: p.handle,
    profile_url: p.profileUrl,
    follower_count: p.followerCount,
    notes: p.notes,
    scouted_at: p.scoutedAt,
    scouted_by: p.scoutedBy,
  }))
  const contactRows = store.contacts.map(contactToRow)
  const associationRows = buildAssociationRows(store)

  const upserts = [
    creatorRows.length ? db.from('creators').upsert(creatorRows) : Promise.resolve({ error: null }),
    profileRows.length ? db.from('profiles').upsert(profileRows) : Promise.resolve({ error: null }),
    contactRows.length ? db.from('contacts').upsert(contactRows) : Promise.resolve({ error: null }),
    store.templates.length
      ? db.from('email_templates').upsert(store.templates.map(templateToRow))
      : Promise.resolve({ error: null }),
    store.emailTouchpoints.length
      ? db.from('email_touchpoints').upsert(store.emailTouchpoints.map(touchpointToRow))
      : Promise.resolve({ error: null }),
    store.outreachSends.length
      ? db.from('outreach_sends').upsert(store.outreachSends.map(outreachSendToRow))
      : Promise.resolve({ error: null }),
    store.activity.length
      ? db.from('activity_events').upsert(store.activity.map(activityToRow))
      : Promise.resolve({ error: null }),
  ]

  const results = await Promise.all(upserts)
  const upsertError = results.find((r) => r.error)?.error
  if (upsertError) {
    throw new Error(`Failed to persist creator pipeline: ${upsertError.message}`)
  }

  const { error: deleteAssocError } = await db
    .from('associations')
    .delete()
    .not('creator_id', 'is', null)

  if (deleteAssocError) {
    throw new Error(`Failed to reset associations: ${deleteAssocError.message}`)
  }

  if (associationRows.length > 0) {
    const { error: insertAssocError } = await db.from('associations').insert(associationRows)
    if (insertAssocError) {
      throw new Error(`Failed to persist associations: ${insertAssocError.message}`)
    }
  }
}

/** Re-export mappers for API responses after partial reads */
export { mapActivityRow, mapOutreachSendRow, mapTemplateRow, mapTouchpointRow }

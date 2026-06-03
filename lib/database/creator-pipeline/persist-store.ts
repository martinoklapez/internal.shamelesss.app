import type { PostgrestError } from '@supabase/supabase-js'
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
  profileToRow,
} from './mappers'
import type { CreatorRow } from './rows'

const AVATAR_PROFILE_ID_MIGRATION =
  'supabase/migrations/20260528200000_creator_pipeline_creator_avatar_profile.sql'

function isMissingAvatarProfileIdColumn(error: PostgrestError | null): boolean {
  const msg = error?.message ?? ''
  return msg.includes('avatar_profile_id') && msg.includes('schema cache')
}

async function upsertCreators(
  db: ReturnType<typeof creatorPipelineDb>,
  creatorRows: CreatorRow[]
) {
  if (creatorRows.length === 0) {
    return { error: null as PostgrestError | null, avatarProfileIdPersisted: true }
  }

  let result = await db.from('creators').upsert(creatorRows)
  if (!isMissingAvatarProfileIdColumn(result.error)) {
    return { error: result.error, avatarProfileIdPersisted: true }
  }

  console.warn(
    `creators.avatar_profile_id not in DB yet — persisting without it. Run ${AVATAR_PROFILE_ID_MIGRATION}`
  )
  const legacyRows = creatorRows.map(
    ({ avatar_profile_id: _avatarProfileId, ...row }) => row
  )
  result = await db.from('creators').upsert(legacyRows)
  return { error: result.error, avatarProfileIdPersisted: false }
}

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
    from_address: s.fromAddress || null,
    from_display_name: s.fromDisplayName || null,
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
  const profileRows = store.profiles.map(profileToRow)
  const contactRows = store.contacts.map(contactToRow)
  const associationRows = buildAssociationRows(store)

  const creatorUpsert = await upsertCreators(db, creatorRows)
  if (creatorUpsert.error) {
    throw new Error(`Failed to persist creator pipeline: ${creatorUpsert.error.message}`)
  }

  // Profiles/contacts must exist before touchpoints/sends (FK on profile_id, contact_id, creator_id).
  const coreUpserts = await Promise.all([
    profileRows.length ? db.from('profiles').upsert(profileRows) : Promise.resolve({ error: null }),
    contactRows.length ? db.from('contacts').upsert(contactRows) : Promise.resolve({ error: null }),
    store.templates.length
      ? db.from('email_templates').upsert(store.templates.map(templateToRow))
      : Promise.resolve({ error: null }),
  ])
  const coreError = coreUpserts.find((r) => r.error)?.error
  if (coreError) {
    throw new Error(`Failed to persist creator pipeline: ${coreError.message}`)
  }

  const dependentUpserts = await Promise.all([
    store.emailTouchpoints.length
      ? db.from('email_touchpoints').upsert(store.emailTouchpoints.map(touchpointToRow))
      : Promise.resolve({ error: null }),
    store.outreachSends.length
      ? db.from('outreach_sends').upsert(store.outreachSends.map(outreachSendToRow))
      : Promise.resolve({ error: null }),
    store.activity.length
      ? db.from('activity_events').upsert(store.activity.map(activityToRow))
      : Promise.resolve({ error: null }),
  ])
  const dependentError = dependentUpserts.find((r) => r.error)?.error
  if (dependentError) {
    throw new Error(`Failed to persist creator pipeline: ${dependentError.message}`)
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

  await pruneOrphanPipelineRows(db, store)
}

async function pruneOrphanPipelineRows(
  db: ReturnType<typeof creatorPipelineDb>,
  store: CreatorOutreachStore
): Promise<void> {
  await pruneTableRows(db, 'creators', store.creators.map((c) => c.id))
  await pruneTableRows(db, 'profiles', store.profiles.map((p) => p.id))
  await pruneTableRows(db, 'contacts', store.contacts.map((c) => c.id))
}

async function pruneTableRows(
  db: ReturnType<typeof creatorPipelineDb>,
  table: 'creators' | 'profiles' | 'contacts',
  keepIds: string[]
): Promise<void> {
  const { data: existing, error: selectError } = await db.from(table).select('id')
  if (selectError) {
    throw new Error(`Failed to list ${table} for prune: ${selectError.message}`)
  }

  const keep = new Set(keepIds)
  const orphanIds = (existing ?? [])
    .map((row) => (row as { id: string }).id)
    .filter((id) => !keep.has(id))

  if (orphanIds.length === 0) return

  const { error: deleteError } = await db.from(table).delete().in('id', orphanIds)
  if (deleteError) {
    throw new Error(`Failed to prune ${table}: ${deleteError.message}`)
  }
}

/** Re-export mappers for API responses after partial reads */
export { mapActivityRow, mapOutreachSendRow, mapTemplateRow, mapTouchpointRow }

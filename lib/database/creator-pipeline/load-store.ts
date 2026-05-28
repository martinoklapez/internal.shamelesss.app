import type { SupabaseClient } from '@supabase/supabase-js'
import type { CreatorOutreachStore } from '@/lib/creator-outreach/types'
import { creatorPipelineDb } from './client'
import {
  applyAssociations,
  mapActivityRow,
  mapCreatorRow,
  mapOutreachSendRow,
  mapTemplateRow,
  mapTouchpointRow,
} from './mappers'
import type {
  ActivityEventRow,
  AssociationRow,
  ContactRow,
  CreatorRow,
  EmailTemplateRow,
  EmailTouchpointRow,
  OutreachSendRow,
  ProfileRow,
} from './rows'

export async function loadCreatorOutreachStoreFromDb(
  supabase: SupabaseClient
): Promise<CreatorOutreachStore> {
  const db = creatorPipelineDb(supabase)

  const [
    creatorsRes,
    profilesRes,
    contactsRes,
    associationsRes,
    templatesRes,
    touchpointsRes,
    sendsRes,
    activityRes,
  ] = await Promise.all([
    db.from('creators').select('*').order('created_at', { ascending: false }),
    db.from('profiles').select('*').order('scouted_at', { ascending: false }),
    db.from('contacts').select('*').order('created_at', { ascending: false }),
    db.from('associations').select('*'),
    db.from('email_templates').select('*').order('is_default', { ascending: false }),
    db.from('email_touchpoints').select('*').order('added_at', { ascending: false }),
    db.from('outreach_sends').select('*').order('sent_at', { ascending: false }),
    db.from('activity_events').select('*').order('created_at', { ascending: false }),
  ])

  const errors = [
    creatorsRes.error,
    profilesRes.error,
    contactsRes.error,
    associationsRes.error,
    templatesRes.error,
    touchpointsRes.error,
    sendsRes.error,
    activityRes.error,
  ].filter(Boolean)

  if (errors.length > 0) {
    const msg = errors.map((e) => e!.message).join('; ')
    throw new Error(`Failed to load creator pipeline: ${msg}`)
  }

  const creators = (creatorsRes.data as CreatorRow[]).map(mapCreatorRow)
  const { profiles, contacts } = applyAssociations(
    profilesRes.data as ProfileRow[],
    contactsRes.data as ContactRow[],
    associationsRes.data as AssociationRow[]
  )

  return {
    creators,
    profiles,
    contacts,
    emailTouchpoints: (touchpointsRes.data as EmailTouchpointRow[]).map(mapTouchpointRow),
    templates: (templatesRes.data as EmailTemplateRow[]).map(mapTemplateRow),
    outreachSends: (sendsRes.data as OutreachSendRow[]).map(mapOutreachSendRow),
    activity: (activityRes.data as ActivityEventRow[]).map(mapActivityRow),
  }
}

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { CreatorOutreachStore } from '@/lib/creator-outreach/types'
import { creatorPipelineDb } from './client'
import {
  applyAssociations,
  mapActivityRow,
  mapCreatorRow,
  mapOutreachRuleRow,
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
  OutreachRuleRow,
  OutreachSendRow,
  ProfileRow,
} from './rows'

async function fetchTable<T>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<{ label: string; data: T[]; error: PostgrestError | null }> {
  const { data, error } = await query
  return { label, data: data ?? [], error }
}

function formatLoadErrors(
  results: Array<{ label: string; error: PostgrestError | null }>
): string | null {
  const failures = results.filter((r) => r.error != null)
  if (failures.length === 0) return null
  return failures
    .map((r) => {
      const cause = (r.error as { cause?: unknown }).cause
      const causeText =
        cause instanceof Error ? cause.message : cause != null ? String(cause) : ''
      return `${r.label}: ${r.error!.message}${causeText ? ` (${causeText})` : ''}`
    })
    .join('; ')
}

function assertLoaded(
  results: Array<{ label: string; error: PostgrestError | null }>
): void {
  const msg = formatLoadErrors(results)
  if (msg) {
    throw new Error(`Failed to load creator pipeline: ${msg}`)
  }
}

export async function loadCreatorOutreachStoreFromDb(
  supabase: SupabaseClient
): Promise<CreatorOutreachStore> {
  const db = creatorPipelineDb(supabase)

  // Sequential table loads avoid bursting 9 parallel connections (common cause of fetch failed in dev).
  const creatorsRes = await fetchTable(
    'creators',
    db.from('creators').select('*').order('created_at', { ascending: false })
  )
  const profilesRes = await fetchTable(
    'profiles',
    db.from('profiles').select('*').order('scouted_at', { ascending: false })
  )
  const contactsRes = await fetchTable(
    'contacts',
    db.from('contacts').select('*').order('created_at', { ascending: false })
  )
  const associationsRes = await fetchTable('associations', db.from('associations').select('*'))
  assertLoaded([creatorsRes, profilesRes, contactsRes, associationsRes])

  const templatesRes = await fetchTable(
    'email_templates',
    db.from('email_templates').select('*').order('is_default', { ascending: false })
  )
  const rulesRes = await fetchTable(
    'outreach_rules',
    db.from('outreach_rules').select('*').order('contact_kind', { ascending: true })
  )
  const touchpointsRes = await fetchTable(
    'email_touchpoints',
    db.from('email_touchpoints').select('*').order('added_at', { ascending: false })
  )
  assertLoaded([templatesRes, rulesRes, touchpointsRes])

  const sendsRes = await fetchTable(
    'outreach_sends',
    db.from('outreach_sends').select('*').order('sent_at', { ascending: false })
  )
  const activityRes = await fetchTable(
    'activity_events',
    db.from('activity_events').select('*').order('created_at', { ascending: false })
  )
  assertLoaded([sendsRes, activityRes])

  const creators = creatorsRes.data.map(mapCreatorRow)
  const { profiles, contacts } = applyAssociations(
    profilesRes.data as ProfileRow[],
    contactsRes.data as ContactRow[],
    associationsRes.data as AssociationRow[]
  )

  return {
    creators,
    profiles,
    contacts,
    emailTouchpoints: touchpointsRes.data.map(mapTouchpointRow),
    templates: templatesRes.data.map(mapTemplateRow),
    outreachRules: rulesRes.data.map(mapOutreachRuleRow),
    outreachSends: sendsRes.data.map(mapOutreachSendRow),
    activity: activityRes.data.map(mapActivityRow),
  }
}

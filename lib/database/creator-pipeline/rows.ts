import type {
  ActivityEventType,
  ContactCrmStatus,
  CreatorContactKind,
  OutreachPlatform,
  OutreachSendStatus,
} from '@/lib/creator-outreach/types'

export type CreatorRow = {
  id: string
  display_name: string
  notes: string
  status: ContactCrmStatus
  created_at: string
  updated_at: string
}

export type ProfileRow = {
  id: string
  platform: OutreachPlatform
  handle: string
  profile_url: string
  follower_count: number | null
  notes: string
  scouted_at: string
  scouted_by: string
}

export type ContactRow = {
  id: string
  kind: CreatorContactKind
  name: string
  company: string
  email: string
  notes: string
  status: ContactCrmStatus
  missive_conversation_ids: string[]
  created_at: string
}

export type AssociationRow = {
  id: string
  creator_id: string
  profile_id: string | null
  contact_id: string | null
  created_at: string
}

export type EmailTemplateRow = {
  id: string
  name: string
  subject: string
  body_preview: string
  is_default: boolean
  created_at: string
}

export type EmailTouchpointRow = {
  id: string
  email: string
  profile_id: string | null
  contact_id: string | null
  creator_id: string | null
  added_at: string
}

export type OutreachSendRow = {
  id: string
  email: string
  template_id: string
  template_name: string
  profile_id: string | null
  contact_id: string | null
  creator_id: string | null
  status: OutreachSendStatus
  sent_at: string
}

export type ActivityEventRow = {
  id: string
  type: ActivityEventType
  message: string
  created_at: string
}

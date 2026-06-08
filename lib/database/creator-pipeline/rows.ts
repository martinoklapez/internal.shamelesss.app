import type {
  ActivityEventType,
  ContactCrmStatus,
  CreatorContactKind,
  OutreachPlatform,
  OutreachRuleAction,
  OutreachRuleTrigger,
  OutreachSendStatus,
} from '@/lib/creator-outreach/types'

export type OutreachEventStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type CreatorRow = {
  id: string
  display_name: string
  notes: string
  avatar_profile_id: string | null
  status: ContactCrmStatus
  created_at: string
  updated_at: string
}

export type ProfileRow = {
  id: string
  platform: OutreachPlatform
  handle: string
  display_name: string
  profile_url: string
  avatar_url: string | null
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
  phone: string
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

export type SendFromAddressRow = {
  id: string
  address: string
  display_name: string
  missive_account_id: string | null
  signature_html: string | null
  host_avatar_url: string | null
  booking_url: string | null
  booking_meeting_name: string | null
  booking_meeting_type: string | null
  booking_duration: string | null
  booking_action_label: string | null
  enabled: boolean
  is_default: boolean
  created_at: string
}

export type OutreachSendRow = {
  id: string
  email: string
  template_id: string
  template_name: string
  from_address: string | null
  from_display_name: string | null
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

export type OutreachRuleRow = {
  id: string
  enabled: boolean
  trigger: OutreachRuleTrigger
  contact_kind: CreatorContactKind
  action: OutreachRuleAction
  template_id: string | null
  send_from_id: string | null
  created_at: string
  updated_at: string
}

export type OutreachEventRow = {
  id: string
  contact_id: string
  trigger: OutreachRuleTrigger
  email_snapshot: string
  status: OutreachEventStatus
  result: Record<string, unknown> | null
  error_message: string | null
  created_at: string
  processed_at: string | null
}

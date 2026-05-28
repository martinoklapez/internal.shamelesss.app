export type OutreachPlatform = 'tiktok' | 'instagram'

export type ContactCrmStatus = 'new' | 'contacted' | 'reached' | 'blocked'

export type OutreachSendStatus = 'queued' | 'sent' | 'skipped_duplicate'

export type CreatorContactKind = 'creator' | 'manager' | 'agency' | 'other'

export type ActivityEventType =
  | 'profile_scouted'
  | 'creator_created'
  | 'profile_linked'
  | 'profile_unlinked'
  | 'contact_added'
  | 'contact_removed'
  | 'email_added'
  | 'outreach_sent'
  | 'outreach_skipped'

/** Creator direct inbox, manager, agency, or other rep — not a social profile. */
export type CreatorContact = {
  id: string
  creatorId: string
  kind: CreatorContactKind
  name: string
  company: string
  email: string
  notes: string
  status: ContactCrmStatus
  /** Missive conversation IDs — set by backend integration, not edited in the UI. */
  missiveConversationIds: string[]
  createdAt: string
}

/** A person — independent from any single social account. */
export type CreatorPerson = {
  id: string
  displayName: string
  notes: string
  /** Rolled up from contacts — automation-driven, not edited in the UI. */
  status: ContactCrmStatus
  createdAt: string
  updatedAt: string
}

/** Standalone social account; may link to zero or one creator. */
export type SocialMediaProfile = {
  id: string
  platform: OutreachPlatform
  handle: string
  profileUrl: string
  followerCount: number | null
  creatorId: string | null
  notes: string
  scoutedAt: string
  scoutedBy: string
}

/** Normalized email touchpoint — tracks which profile/creator it came from. */
export type EmailTouchpoint = {
  id: string
  email: string
  profileId: string | null
  contactId: string | null
  creatorId: string | null
  addedAt: string
}

export type EmailTemplate = {
  id: string
  name: string
  subject: string
  bodyPreview: string
  isDefault: boolean
}

export type OutreachSend = {
  id: string
  email: string
  templateId: string
  templateName: string
  profileId: string | null
  contactId: string | null
  creatorId: string | null
  status: OutreachSendStatus
  sentAt: string
}

export type ActivityEvent = {
  id: string
  type: ActivityEventType
  message: string
  createdAt: string
}

export type CreatorOutreachStore = {
  creators: CreatorPerson[]
  profiles: SocialMediaProfile[]
  contacts: CreatorContact[]
  emailTouchpoints: EmailTouchpoint[]
  templates: EmailTemplate[]
  outreachSends: OutreachSend[]
  activity: ActivityEvent[]
}

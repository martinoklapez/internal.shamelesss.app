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
  | 'contact_unlinked'
  | 'contact_removed'
  | 'email_added'
  | 'outreach_queued'
  | 'outreach_sent'
  | 'outreach_skipped'

/** Fires when a contact gains a usable email (create with email or add/change on update). */
export type OutreachRuleTrigger = 'contact_email_ready'

export type OutreachRuleAction = 'send_email' | 'do_not_send'

export type SendFromAddress = {
  id: string
  address: string
  displayName: string
  /** Missive shared email account ID (Settings → API → Resource IDs). */
  missiveAccountId?: string
  /** HTML signature appended after the template body on send. */
  signatureHtml?: string
  enabled: boolean
  isDefault: boolean
}

export type OutreachRule = {
  id: string
  enabled: boolean
  trigger: OutreachRuleTrigger
  contactKind: CreatorContactKind
  action: OutreachRuleAction
  templateId: string | null
  sendFromId: string | null
  createdAt: string
  updatedAt: string
}

/** Creator direct inbox, manager, agency, or other rep — not a social profile. */
export type CreatorContact = {
  id: string
  /** `null` when unlinked from any creator (still in pipeline). */
  creatorId: string | null
  kind: CreatorContactKind
  name: string
  company: string
  email: string
  /** E.164 (`+14155552671`). Empty when unknown. */
  phone: string
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
  /**
   * Linked profile whose `avatarUrl` is shown for this creator.
   * `null` = use the earliest scouted linked profile.
   */
  avatarProfileId: string | null
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
  /** Platform display name (nickname / full name), distinct from @handle. */
  displayName: string
  profileUrl: string
  /** Cached avatar in Supabase Storage (`creator-pipeline-avatars` bucket). */
  avatarUrl: string | null
  followerCount: number | null
  creatorId: string | null
  notes: string
  scoutedAt: string
  /** Supabase auth user id of whoever scouted the profile. */
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
  fromAddress: string
  fromDisplayName: string
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
  sendFromAddresses: SendFromAddress[]
  outreachRules: OutreachRule[]
  outreachSends: OutreachSend[]
  activity: ActivityEvent[]
}

export const OUTREACH_CONTACT_KINDS: CreatorContactKind[] = [
  'creator',
  'manager',
  'agency',
  'other',
]

import type {
  ActivityEvent,
  CreatorContact,
  CreatorContactKind,
  CreatorOutreachStore,
  CreatorPerson,
  EmailTemplate,
  EmailTouchpoint,
  OutreachPlatform,
  OutreachSend,
  ContactCrmStatus,
  SocialMediaProfile,
} from './types'

function uid(): string {
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

import { deriveCreatorCrmStatusFromContacts } from './crm-status'
import { inferCreatorContactKind } from './infer-contact-kind'

function syncCreatorCrmStatusFromContacts(
  store: CreatorOutreachStore,
  creatorId: string
): void {
  const creator = store.creators.find((c) => c.id === creatorId)
  if (!creator) return
  creator.status = deriveCreatorCrmStatusFromContacts(store, creatorId)
}

function pushActivity(
  store: CreatorOutreachStore,
  type: ActivityEvent['type'],
  message: string
): ActivityEvent {
  const event: ActivityEvent = { id: uid(), type, message, createdAt: nowIso() }
  store.activity.unshift(event)
  return event
}

export type ScoutProfileInput = {
  platform: OutreachPlatform
  handle: string
  profileUrl?: string
  followerCount?: number | null
  notes?: string
  scoutedBy?: string
  creatorId?: string | null
  newCreatorName?: string
}

export type EvaluateOutreachResult =
  | { action: 'sent'; send: OutreachSend }
  | { action: 'skipped'; reason: string }
  | { action: 'none'; reason: string }

function defaultTemplate(store: CreatorOutreachStore): EmailTemplate {
  return store.templates.find((t) => t.isDefault) ?? store.templates[0]
}

export function hasOutreachBeenSentToEmail(store: CreatorOutreachStore, email: string): boolean {
  const normalized = normalizeEmail(email)
  return store.outreachSends.some(
    (s) => normalizeEmail(s.email) === normalized && s.status === 'sent'
  )
}

export function evaluateAndTriggerOutreach(
  store: CreatorOutreachStore,
  opts: {
    email: string
    profileId: string | null
    contactId?: string | null
    creatorId: string | null
    templateId?: string
  }
): EvaluateOutreachResult {
  const normalized = normalizeEmail(opts.email)
  if (!normalized || !normalized.includes('@')) {
    return { action: 'none', reason: 'Invalid email' }
  }

  if (hasOutreachBeenSentToEmail(store, normalized)) {
    const skipped: OutreachSend = {
      id: uid(),
      email: normalized,
      templateId: opts.templateId ?? defaultTemplate(store).id,
      templateName: defaultTemplate(store).name,
      profileId: opts.profileId,
      contactId: opts.contactId ?? null,
      creatorId: opts.creatorId,
      status: 'skipped_duplicate',
      sentAt: nowIso(),
    }
    store.outreachSends.unshift(skipped)
    pushActivity(
      store,
      'outreach_skipped',
      `Skipped outreach — already sent to ${normalized}`
    )
    syncContactCrmStatusFromOutreach(store, opts.contactId ?? null, 'skipped_duplicate')
    return { action: 'skipped', reason: 'Email already received outreach' }
  }

  const tpl = opts.templateId
    ? store.templates.find((t) => t.id === opts.templateId) ?? defaultTemplate(store)
    : defaultTemplate(store)

  const send: OutreachSend = {
    id: uid(),
    email: normalized,
    templateId: tpl.id,
    templateName: tpl.name,
    profileId: opts.profileId,
    contactId: opts.contactId ?? null,
    creatorId: opts.creatorId,
    status: 'sent',
    sentAt: nowIso(),
  }
  store.outreachSends.unshift(send)
  pushActivity(
    store,
    'outreach_sent',
    `Sent "${tpl.name}" to ${normalized}`
  )
  syncContactCrmStatusFromOutreach(store, opts.contactId ?? null, 'sent')
  return { action: 'sent', send }
}

/** CRM status is automation-driven only — updated when outreach runs. */
function syncContactCrmStatusFromOutreach(
  store: CreatorOutreachStore,
  contactId: string | null,
  event: 'email_ready' | 'sent' | 'skipped_duplicate'
): void {
  if (!contactId) return
  const contact = store.contacts.find((c) => c.id === contactId)
  if (!contact) return
  if (event === 'email_ready' && contact.email) {
    if (contact.status === 'new') contact.status = 'contacted'
    syncCreatorCrmStatusFromContacts(store, contact.creatorId)
    return
  }
  if (event === 'sent' || event === 'skipped_duplicate') {
    if (contact.status === 'new' || contact.status === 'contacted') {
      contact.status = 'contacted'
    }
  }
  syncCreatorCrmStatusFromContacts(store, contact.creatorId)
}

function registerEmailTouchpoint(
  store: CreatorOutreachStore,
  email: string,
  opts: {
    profileId: string | null
    contactId: string | null
    creatorId: string | null
  }
): EmailTouchpoint | null {
  const normalized = normalizeEmail(email)
  if (!normalized || !normalized.includes('@')) return null

  const existing = store.emailTouchpoints.find(
    (t) =>
      normalizeEmail(t.email) === normalized &&
      t.profileId === opts.profileId &&
      t.contactId === opts.contactId &&
      t.creatorId === opts.creatorId
  )
  if (existing) return existing

  const touch: EmailTouchpoint = {
    id: uid(),
    email: normalized,
    profileId: opts.profileId,
    contactId: opts.contactId,
    creatorId: opts.creatorId,
    addedAt: nowIso(),
  }
  store.emailTouchpoints.unshift(touch)
  return touch
}

export function scoutProfile(
  store: CreatorOutreachStore,
  input: ScoutProfileInput
): { store: CreatorOutreachStore; profile: SocialMediaProfile; outreach?: EvaluateOutreachResult } {
  const handle = input.handle.trim().replace(/^@/, '')
  const platform = input.platform
  const profileUrl =
    input.profileUrl?.trim() ||
    (platform === 'tiktok'
      ? `https://www.tiktok.com/@${handle}`
      : `https://www.instagram.com/${handle}`)

  let creatorId = input.creatorId ?? null

  if (input.newCreatorName?.trim()) {
    const creator: CreatorPerson = {
      id: uid(),
      displayName: input.newCreatorName.trim(),
      notes: '',
      status: 'new',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    store.creators.unshift(creator)
    creatorId = creator.id
    pushActivity(store, 'creator_created', `Created creator "${creator.displayName}"`)
  }

  const profile: SocialMediaProfile = {
    id: uid(),
    platform,
    handle,
    profileUrl,
    followerCount: input.followerCount ?? null,
    creatorId,
    notes: input.notes?.trim() ?? '',
    scoutedAt: nowIso(),
    scoutedBy: input.scoutedBy?.trim() || 'Team',
  }

  store.profiles.unshift(profile)
  pushActivity(
    store,
    'profile_scouted',
    `Scouted @${handle} on ${platform === 'tiktok' ? 'TikTok' : 'Instagram'}${creatorId ? ' (linked)' : ''}`
  )

  return { store, profile }
}

export function createCreator(
  store: CreatorOutreachStore,
  displayName: string
): CreatorPerson {
  const creator: CreatorPerson = {
    id: uid(),
    displayName: displayName.trim(),
    notes: '',
    status: 'new',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  store.creators.unshift(creator)
  pushActivity(store, 'creator_created', `Created creator "${creator.displayName}"`)
  return creator
}

export function linkProfileToCreator(
  store: CreatorOutreachStore,
  profileId: string,
  creatorId: string
): CreatorOutreachStore {
  const profile = store.profiles.find((p) => p.id === profileId)
  const creator = store.creators.find((c) => c.id === creatorId)
  if (!profile || !creator) return store

  profile.creatorId = creatorId
  creator.updatedAt = nowIso()
  pushActivity(
    store,
    'profile_linked',
    `Linked @${profile.handle} (${profile.platform}) to ${creator.displayName}`
  )
  return store
}

export function unlinkProfileFromCreator(
  store: CreatorOutreachStore,
  profileId: string
): CreatorOutreachStore {
  const profile = store.profiles.find((p) => p.id === profileId)
  if (!profile || !profile.creatorId) return store
  const creator = store.creators.find((c) => c.id === profile.creatorId)
  profile.creatorId = null
  pushActivity(
    store,
    'profile_unlinked',
    `Unlinked @${profile.handle} from ${creator?.displayName ?? 'creator'}`
  )
  return store
}

export function updateCreator(
  store: CreatorOutreachStore,
  creatorId: string,
  patch: Partial<Pick<CreatorPerson, 'displayName' | 'notes'>>
): CreatorOutreachStore {
  const creator = store.creators.find((c) => c.id === creatorId)
  if (!creator) return store
  if (patch.displayName !== undefined) creator.displayName = patch.displayName.trim()
  if (patch.notes !== undefined) creator.notes = patch.notes
  creator.updatedAt = nowIso()
  return store
}

export function updateProfile(
  store: CreatorOutreachStore,
  profileId: string,
  patch: Partial<Pick<SocialMediaProfile, 'notes' | 'followerCount' | 'handle'>>
): CreatorOutreachStore {
  const profile = store.profiles.find((p) => p.id === profileId)
  if (!profile) return store

  if (patch.handle !== undefined) profile.handle = patch.handle.trim().replace(/^@/, '')
  if (patch.notes !== undefined) profile.notes = patch.notes
  if (patch.followerCount !== undefined) profile.followerCount = patch.followerCount

  return store
}

export function getEmailsForCreator(
  store: CreatorOutreachStore,
  creatorId: string
): string[] {
  const emails = new Set<string>()
  for (const c of store.contacts) {
    if (c.creatorId === creatorId && c.email) emails.add(normalizeEmail(c.email))
  }
  return [...emails]
}

export function getContactsForCreator(
  store: CreatorOutreachStore,
  creatorId: string
): CreatorContact[] {
  return store.contacts.filter((c) => c.creatorId === creatorId)
}

export function contactKindLabel(kind: CreatorContactKind): string {
  if (kind === 'creator') return 'Creator'
  if (kind === 'manager') return 'Manager'
  if (kind === 'agency') return 'Agency'
  return 'Contact'
}

function applyInferredContactKind(
  store: CreatorOutreachStore,
  contact: CreatorContact
): void {
  if (!contact.email) return
  contact.kind = inferCreatorContactKind(
    store,
    contact.creatorId,
    contact.email,
    contact.name
  )
}

export type AddCreatorContactInput = {
  creatorId: string
  kind: CreatorContactKind
  name: string
  company?: string
  email?: string
  notes?: string
}

export type UpdateCreatorContactInput = Partial<
  Pick<CreatorContact, 'kind' | 'name' | 'company' | 'email' | 'notes'>
>

export function addCreatorContact(
  store: CreatorOutreachStore,
  input: AddCreatorContactInput
): { store: CreatorOutreachStore; contact: CreatorContact; outreach?: EvaluateOutreachResult } {
  const contact: CreatorContact = {
    id: uid(),
    creatorId: input.creatorId,
    kind: input.kind,
    name: input.name.trim(),
    company: input.company?.trim() ?? '',
    email: input.email ? normalizeEmail(input.email) : '',
    notes: input.notes?.trim() ?? '',
    status: 'new',
    missiveConversationIds: [],
    createdAt: nowIso(),
  }
  applyInferredContactKind(store, contact)
  store.contacts.unshift(contact)
  const creator = store.creators.find((c) => c.id === input.creatorId)
  pushActivity(
    store,
    'contact_added',
    `Added ${contactKindLabel(contact.kind)} "${contact.name}" for ${creator?.displayName ?? 'creator'}`
  )

  let outreach: EvaluateOutreachResult | undefined
  if (contact.email) {
    syncContactCrmStatusFromOutreach(store, contact.id, 'email_ready')
    registerEmailTouchpoint(store, contact.email, {
      profileId: null,
      contactId: contact.id,
      creatorId: contact.creatorId,
    })
    pushActivity(store, 'email_added', `Email on contact ${contact.name}: ${contact.email}`)
    outreach = evaluateAndTriggerOutreach(store, {
      email: contact.email,
      profileId: null,
      contactId: contact.id,
      creatorId: contact.creatorId,
    })
  }

  return { store, contact, outreach }
}

export function updateCreatorContact(
  store: CreatorOutreachStore,
  contactId: string,
  patch: UpdateCreatorContactInput
): { store: CreatorOutreachStore; outreach?: EvaluateOutreachResult } {
  const contact = store.contacts.find((c) => c.id === contactId)
  if (!contact) return { store }

  if (patch.kind !== undefined) contact.kind = patch.kind
  if (patch.name !== undefined) contact.name = patch.name.trim()
  if (patch.company !== undefined) contact.company = patch.company.trim()
  if (patch.notes !== undefined) contact.notes = patch.notes

  if (patch.email !== undefined) {
    const normalized = normalizeEmail(patch.email)
    const hadEmail = Boolean(contact.email)
    contact.email = normalized
    if (!normalized) return { store }
    applyInferredContactKind(store, contact)
    if (!hadEmail || contact.email !== normalized) {
      syncContactCrmStatusFromOutreach(store, contact.id, 'email_ready')
      registerEmailTouchpoint(store, normalized, {
        profileId: null,
        contactId: contact.id,
        creatorId: contact.creatorId,
      })
      pushActivity(store, 'email_added', `Email on contact ${contact.name}: ${normalized}`)
      const outreach = evaluateAndTriggerOutreach(store, {
        email: normalized,
        profileId: null,
        contactId: contact.id,
        creatorId: contact.creatorId,
      })
      return { store, outreach }
    }
  }

  return { store }
}

export function contactCrmStatusLabel(status: ContactCrmStatus): string {
  if (status === 'new') return 'New'
  if (status === 'contacted') return 'Contacted'
  if (status === 'reached') return 'Reached'
  return 'Blocked'
}

export function removeCreatorContact(
  store: CreatorOutreachStore,
  contactId: string
): CreatorOutreachStore {
  const contact = store.contacts.find((c) => c.id === contactId)
  if (!contact) return store
  const creatorId = contact.creatorId
  store.contacts = store.contacts.filter((c) => c.id !== contactId)
  pushActivity(
    store,
    'contact_removed',
    `Removed ${contactKindLabel(contact.kind)} "${contact.name}"`
  )
  syncCreatorCrmStatusFromContacts(store, creatorId)
  return store
}

export function platformLabel(platform: OutreachPlatform): string {
  return platform === 'tiktok' ? 'TikTok' : 'Instagram'
}

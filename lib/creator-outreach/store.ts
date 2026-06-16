import type {
  ActivityEvent,
  CreatorContact,
  CreatorContactKind,
  CreatorOutreachStore,
  CreatorPerson,
  EmailTouchpoint,
  OutreachPlatform,
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
import {
  draftContactNotes,
  type DraftContactFromProfile,
} from '@/lib/social-profile-draft-contact'
import { normalizePhone } from '@/lib/normalize-phone'

export { normalizePhone } from '@/lib/normalize-phone'
export { formatPhoneForDisplay, isValidPhoneInput } from '@/lib/normalize-phone'

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
  displayName?: string
  profileUrl?: string
  /** Remote CDN URL to download and cache in Supabase Storage (server-side). */
  profilePictureSourceUrl?: string | null
  followerCount?: number | null
  notes?: string
  /** Supabase auth user id; set by API when omitted. */
  scoutedBy?: string
  creatorId?: string | null
  newCreatorName?: string
  /** When set with a linked creator, creates a CRM contact from scraped profile email. */
  draftContact?: DraftContactFromProfile | null
}

export type { ContactEmailReadyEvent, EvaluateOutreachResult } from './rules-engine'
export { hasActiveOutreachForEmail } from './rules-engine'

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
): {
  store: CreatorOutreachStore
  profile: SocialMediaProfile
  contactFromDraft?: CreatorContact
  emailReadyContactId?: string
} {
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
      avatarProfileId: null,
      status: 'new',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    store.creators.unshift(creator)
    creatorId = creator.id
    pushActivity(store, 'creator_created', `Created creator "${creator.displayName}"`)
  }

  const displayName = input.displayName?.trim() || handle

  const profile: SocialMediaProfile = {
    id: uid(),
    platform,
    handle,
    displayName,
    profileUrl,
    avatarUrl: null,
    followerCount: input.followerCount ?? null,
    creatorId,
    notes: input.notes?.trim() ?? '',
    scoutedAt: nowIso(),
    scoutedBy: input.scoutedBy?.trim() ?? '',
  }

  store.profiles.unshift(profile)
  pushActivity(
    store,
    'profile_scouted',
    `Scouted @${handle} on ${platform === 'tiktok' ? 'TikTok' : 'Instagram'}${creatorId ? ' (linked)' : ''}`
  )

  let contactFromDraft: CreatorContact | undefined
  let emailReadyContactId: string | undefined

  if (input.draftContact?.email && creatorId) {
    const normalized = normalizeEmail(input.draftContact.email)
    const duplicate = store.contacts.some(
      (c) => c.creatorId === creatorId && normalizeEmail(c.email) === normalized
    )
    if (!duplicate) {
      const kind = inferCreatorContactKind(
        store,
        creatorId,
        normalized,
        input.draftContact.name
      )
      const contactResult = addCreatorContact(store, {
        creatorId,
        kind,
        name: input.draftContact.name.trim() || displayName,
        email: normalized,
        notes: draftContactNotes(input.draftContact, platform, handle),
        linkedProfileId: profile.id,
      })
      Object.assign(store, contactResult.store)
      contactFromDraft = contactResult.contact
      emailReadyContactId = contactResult.emailReadyContactId
    }
  }

  return { store, profile, contactFromDraft, emailReadyContactId }
}

export function createCreator(
  store: CreatorOutreachStore,
  displayName: string
): CreatorPerson {
  const creator: CreatorPerson = {
    id: uid(),
    displayName: displayName.trim(),
    notes: '',
    avatarProfileId: null,
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
  patch: Partial<Pick<CreatorPerson, 'displayName' | 'notes' | 'avatarProfileId'>>
): CreatorOutreachStore {
  const creator = store.creators.find((c) => c.id === creatorId)
  if (!creator) return store
  if (patch.displayName !== undefined) creator.displayName = patch.displayName.trim()
  if (patch.notes !== undefined) creator.notes = patch.notes
  if (patch.avatarProfileId !== undefined) {
    if (patch.avatarProfileId === null) {
      creator.avatarProfileId = null
    } else {
      const linked = store.profiles.some(
        (p) => p.id === patch.avatarProfileId && p.creatorId === creatorId
      )
      if (linked) creator.avatarProfileId = patch.avatarProfileId
    }
  }
  creator.updatedAt = nowIso()
  return store
}

export function updateProfile(
  store: CreatorOutreachStore,
  profileId: string,
  patch: Partial<
    Pick<SocialMediaProfile, 'notes' | 'followerCount' | 'handle' | 'avatarUrl' | 'displayName'>
  >
): CreatorOutreachStore {
  const profile = store.profiles.find((p) => p.id === profileId)
  if (!profile) return store

  if (patch.handle !== undefined) profile.handle = patch.handle.trim().replace(/^@/, '')
  if (patch.displayName !== undefined) profile.displayName = patch.displayName.trim()
  if (patch.notes !== undefined) profile.notes = patch.notes
  if (patch.followerCount !== undefined) profile.followerCount = patch.followerCount
  if (patch.avatarUrl !== undefined) profile.avatarUrl = patch.avatarUrl

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
  return 'Other'
}

function applyInferredContactKind(
  store: CreatorOutreachStore,
  contact: CreatorContact
): void {
  if (!contact.email || !contact.creatorId) return
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
  phone?: string
  notes?: string
  /** Links the email touchpoint to a scouted profile when provided. */
  linkedProfileId?: string | null
}

export type UpdateCreatorContactInput = Partial<
  Pick<CreatorContact, 'kind' | 'name' | 'company' | 'email' | 'phone' | 'notes' | 'status'>
>

/** Reassign a contact from another creator to `creatorId`. */
export function unlinkContactFromCreator(
  store: CreatorOutreachStore,
  contactId: string
): CreatorOutreachStore {
  const contact = store.contacts.find((c) => c.id === contactId)
  if (!contact || !contact.creatorId) return store

  const creatorId = contact.creatorId
  const creator = store.creators.find((c) => c.id === creatorId)
  contact.creatorId = null
  pushActivity(
    store,
    'contact_unlinked',
    `Unlinked ${contactKindLabel(contact.kind)} "${contact.name}" from ${creator?.displayName ?? 'creator'}`
  )
  syncCreatorCrmStatusFromContacts(store, creatorId)
  return store
}

export function linkContactToCreator(
  store: CreatorOutreachStore,
  contactId: string,
  creatorId: string
): CreatorOutreachStore {
  const contact = store.contacts.find((c) => c.id === contactId)
  if (!contact || contact.creatorId === creatorId) return store

  const fromCreator = contact.creatorId
    ? store.creators.find((c) => c.id === contact.creatorId)
    : null
  const toCreator = store.creators.find((c) => c.id === creatorId)
  contact.creatorId = creatorId
  applyInferredContactKind(store, contact)
  pushActivity(
    store,
    'contact_added',
    `Linked ${contactKindLabel(contact.kind)} "${contact.name}" to ${toCreator?.displayName ?? 'creator'}${
      fromCreator ? ` (from ${fromCreator.displayName})` : ''
    }`
  )
  return store
}

export function addCreatorContact(
  store: CreatorOutreachStore,
  input: AddCreatorContactInput
): {
  store: CreatorOutreachStore
  contact: CreatorContact
  emailReadyContactId?: string
} {
  const contact: CreatorContact = {
    id: uid(),
    creatorId: input.creatorId,
    kind: input.kind,
    name: input.name.trim(),
    company: input.company?.trim() ?? '',
    email: input.email ? normalizeEmail(input.email) : '',
    phone: input.phone ? normalizePhone(input.phone) : '',
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

  let emailReadyContactId: string | undefined
  if (contact.email) {
    registerEmailTouchpoint(store, contact.email, {
      profileId: input.linkedProfileId ?? null,
      contactId: contact.id,
      creatorId: contact.creatorId,
    })
    pushActivity(store, 'email_added', `Email on contact ${contact.name}: ${contact.email}`)
    emailReadyContactId = contact.id
  }

  return { store, contact, emailReadyContactId }
}

export function updateCreatorContact(
  store: CreatorOutreachStore,
  contactId: string,
  patch: UpdateCreatorContactInput
): { store: CreatorOutreachStore; emailReadyContactId?: string } {
  const contact = store.contacts.find((c) => c.id === contactId)
  if (!contact) return { store }

  if (patch.kind !== undefined) contact.kind = patch.kind
  if (patch.name !== undefined) contact.name = patch.name.trim()
  if (patch.company !== undefined) contact.company = patch.company.trim()
  if (patch.notes !== undefined) contact.notes = patch.notes

  if (patch.phone !== undefined) {
    contact.phone = normalizePhone(patch.phone)
  }

  if (patch.status !== undefined && patch.status !== contact.status) {
    contact.status = patch.status
    if (contact.creatorId) {
      const creator = store.creators.find((c) => c.id === contact.creatorId)
      if (creator) {
        creator.status = deriveCreatorCrmStatusFromContacts(store, contact.creatorId)
        creator.updatedAt = nowIso()
      }
    }
  }

  if (patch.email !== undefined) {
    const normalized = normalizeEmail(patch.email)
    const hadEmail = Boolean(contact.email)
    contact.email = normalized
    if (!normalized) return { store }
    if (contact.creatorId) applyInferredContactKind(store, contact)
    if (!hadEmail || contact.email !== normalized) {
      registerEmailTouchpoint(store, normalized, {
        profileId: null,
        contactId: contact.id,
        creatorId: contact.creatorId,
      })
      pushActivity(store, 'email_added', `Email on contact ${contact.name}: ${normalized}`)
      return { store, emailReadyContactId: contact.id }
    }
  }

  return { store }
}

export { contactCrmStatusLabel } from './crm-status-ui'

export function removeProfile(
  store: CreatorOutreachStore,
  profileId: string
): CreatorOutreachStore {
  const profile = store.profiles.find((p) => p.id === profileId)
  if (!profile) return store

  store.profiles = store.profiles.filter((p) => p.id !== profileId)
  store.emailTouchpoints = store.emailTouchpoints.filter((t) => t.profileId !== profileId)
  store.outreachSends = store.outreachSends.filter((s) => s.profileId !== profileId)
  return store
}

export function removeCreator(
  store: CreatorOutreachStore,
  creatorId: string
): { store: CreatorOutreachStore; deletedContactIds: string[] } {
  const creator = store.creators.find((c) => c.id === creatorId)
  if (!creator) return { store, deletedContactIds: [] }

  const deletedContactIds = store.contacts
    .filter((c) => c.creatorId === creatorId)
    .map((c) => c.id)

  for (const profile of store.profiles) {
    if (profile.creatorId === creatorId) profile.creatorId = null
  }

  store.contacts = store.contacts.filter((c) => c.creatorId !== creatorId)
  store.creators = store.creators.filter((c) => c.id !== creatorId)

  store.emailTouchpoints = store.emailTouchpoints.filter(
    (t) => t.creatorId !== creatorId && !deletedContactIds.includes(t.contactId ?? '')
  )
  store.outreachSends = store.outreachSends.filter(
    (s) =>
      s.creatorId !== creatorId && !deletedContactIds.includes(s.contactId ?? '')
  )

  return { store, deletedContactIds }
}

export function removeCreatorContact(
  store: CreatorOutreachStore,
  contactId: string
): CreatorOutreachStore {
  const contact = store.contacts.find((c) => c.id === contactId)
  if (!contact) return store
  const creatorId = contact.creatorId
  store.contacts = store.contacts.filter((c) => c.id !== contactId)
  store.emailTouchpoints = store.emailTouchpoints.filter((t) => t.contactId !== contactId)
  store.outreachSends = store.outreachSends.filter((s) => s.contactId !== contactId)
  pushActivity(
    store,
    'contact_removed',
    `Removed ${contactKindLabel(contact.kind)} "${contact.name}"`
  )
  if (creatorId) syncCreatorCrmStatusFromContacts(store, creatorId)
  return store
}

export function platformLabel(platform: OutreachPlatform): string {
  return platform === 'tiktok' ? 'TikTok' : 'Instagram'
}

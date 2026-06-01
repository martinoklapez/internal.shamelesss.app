import {
  getProfilesForCreator,
  resolveCreatorAvatarImageSrc,
} from './creator-avatar'
import { normalizeEmail } from './store'
import type {
  ContactCrmStatus,
  CreatorContact,
  CreatorContactKind,
  CreatorOutreachStore,
  CreatorPerson,
  OutreachPlatform,
  SocialMediaProfile,
} from './types'

export type MissiveContextMatchedBy = 'conversation_id' | 'email' | null

export type MissiveContextProfileDto = {
  id: string
  platform: OutreachPlatform
  handle: string
  displayName: string
  profileUrl: string
  avatarUrl: string | null
  followerCount: number | null
  creatorId: string | null
  notes: string
}

export type MissiveContextCreatorDto = {
  id: string
  displayName: string
  status: ContactCrmStatus
  notes: string
  avatarImageSrc: string
}

export type MissiveContextContactDto = {
  id: string
  name: string
  email: string
  phone: string
  kind: CreatorContactKind
  status: ContactCrmStatus
  outreachSent: boolean
}

export type MissiveContextResponse = {
  conversationId: string
  matchedBy: MissiveContextMatchedBy
  matchedContactId: string | null
  contact: MissiveContextContactDto | null
  creator: MissiveContextCreatorDto | null
  linkedProfiles: MissiveContextProfileDto[]
  contacts: MissiveContextContactDto[]
}

function toProfileDto(profile: SocialMediaProfile): MissiveContextProfileDto {
  return {
    id: profile.id,
    platform: profile.platform,
    handle: profile.handle,
    displayName: profile.displayName,
    profileUrl: profile.profileUrl,
    avatarUrl: profile.avatarUrl,
    followerCount: profile.followerCount,
    creatorId: profile.creatorId,
    notes: profile.notes,
  }
}

function toCreatorDto(
  creator: CreatorPerson,
  linkedProfiles: SocialMediaProfile[]
): MissiveContextCreatorDto {
  return {
    id: creator.id,
    displayName: creator.displayName,
    status: creator.status,
    notes: creator.notes,
    avatarImageSrc: resolveCreatorAvatarImageSrc(creator, linkedProfiles),
  }
}

function buildSentEmailSet(store: CreatorOutreachStore): Set<string> {
  return new Set(
    store.outreachSends
      .filter((s) => s.status === 'sent' || s.status === 'queued')
      .map((s) => normalizeEmail(s.email))
  )
}

function toContactDto(
  contact: CreatorContact,
  sentEmailSet: Set<string>
): MissiveContextContactDto {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    kind: contact.kind,
    status: contact.status,
    outreachSent: contact.email ? sentEmailSet.has(normalizeEmail(contact.email)) : false,
  }
}

function findContactByConversationId(
  store: CreatorOutreachStore,
  conversationId: string
): CreatorContact | null {
  if (!conversationId.trim()) return null
  return (
    store.contacts.find((c) =>
      c.missiveConversationIds.some((id) => id === conversationId)
    ) ?? null
  )
}

function findContactByEmails(
  store: CreatorOutreachStore,
  emails: string[]
): CreatorContact | null {
  const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))]
  if (normalized.length === 0) return null

  const matches = store.contacts.filter(
    (c) => c.email && normalized.includes(normalizeEmail(c.email))
  )
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]

  const linked = matches.filter((c) => c.creatorId)
  if (linked.length === 1) return linked[0]
  if (linked.length > 1) return linked[0]

  return matches[0]
}

export function lookupMissiveConversationContext(
  store: CreatorOutreachStore,
  input: { conversationId: string; emails?: string[] }
): MissiveContextResponse {
  const conversationId = input.conversationId.trim()
  const sentEmailSet = buildSentEmailSet(store)

  let contact: CreatorContact | null = null
  let matchedBy: MissiveContextMatchedBy = null

  if (conversationId) {
    contact = findContactByConversationId(store, conversationId)
    if (contact) matchedBy = 'conversation_id'
  }

  if (!contact) {
    contact = findContactByEmails(store, input.emails ?? [])
    if (contact) matchedBy = 'email'
  }

  if (!contact) {
    return {
      conversationId,
      matchedBy: null,
      matchedContactId: null,
      contact: null,
      creator: null,
      linkedProfiles: [],
      contacts: [],
    }
  }

  const contactDto = toContactDto(contact, sentEmailSet)

  if (!contact.creatorId) {
    return {
      conversationId,
      matchedBy,
      matchedContactId: contact.id,
      contact: contactDto,
      creator: null,
      linkedProfiles: [],
      contacts: [contactDto],
    }
  }

  const creator = store.creators.find((c) => c.id === contact.creatorId) ?? null
  const linkedProfiles = getProfilesForCreator(store, contact.creatorId)
  const contacts = store.contacts
    .filter((c) => c.creatorId === contact.creatorId)
    .map((c) => toContactDto(c, sentEmailSet))

  return {
    conversationId,
    matchedBy,
    matchedContactId: contact.id,
    contact: contactDto,
    creator: creator ? toCreatorDto(creator, linkedProfiles) : null,
    linkedProfiles: linkedProfiles.map(toProfileDto),
    contacts,
  }
}

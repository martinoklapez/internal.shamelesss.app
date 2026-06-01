import type { DraftContactFromProfile } from '@/lib/social-profile-draft-contact'
import {
  addCreatorContact,
  createCreator,
  linkContactToCreator,
  linkProfileToCreator,
  normalizeEmail,
  updateProfile,
  type ScoutProfileInput,
} from './store'
import type {
  CreatorContact,
  CreatorOutreachStore,
  CreatorPerson,
  OutreachPlatform,
  SocialMediaProfile,
} from './types'
import { draftContactNotes } from '@/lib/social-profile-draft-contact'
import { inferCreatorContactKind } from './infer-contact-kind'
import { platformLabel } from './store'

const OTHER_PLATFORM: Record<OutreachPlatform, OutreachPlatform> = {
  instagram: 'tiktok',
  tiktok: 'instagram',
}

export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, '').toLowerCase()
}

export function findProfileByPlatformHandle(
  store: CreatorOutreachStore,
  platform: OutreachPlatform,
  handle: string
): SocialMediaProfile | undefined {
  return findProfileByHandleOnPlatform(store, platform, handle)
}

/** Profile on a specific platform with normalized handle (strips leading @). */
export function findProfileByHandleOnPlatform(
  store: CreatorOutreachStore,
  platform: OutreachPlatform,
  handle: string
): SocialMediaProfile | undefined {
  const key = normalizeHandle(handle)
  return store.profiles.find(
    (p) => p.platform === platform && normalizeHandle(p.handle) === key
  )
}

/**
 * Same username on the other network (e.g. TikTok @user ↔ Instagram /user).
 * Used when email/contact matching does not apply.
 */
export function findCrossPlatformProfileByHandle(
  store: CreatorOutreachStore,
  platform: OutreachPlatform,
  handle: string
): SocialMediaProfile | undefined {
  return findProfileByHandleOnPlatform(store, OTHER_PLATFORM[platform], handle)
}

function findCreatorForCrossPlatformHandle(
  store: CreatorOutreachStore,
  platform: OutreachPlatform,
  handle: string
): { creator: CreatorPerson; sibling: SocialMediaProfile } | null {
  const sibling = findCrossPlatformProfileByHandle(store, platform, handle)
  if (!sibling?.creatorId) return null
  const creator = store.creators.find((c) => c.id === sibling.creatorId)
  if (!creator) return null
  return { creator, sibling }
}

export function findContactsByEmail(
  store: CreatorOutreachStore,
  email: string
): CreatorContact[] {
  const normalized = normalizeEmail(email)
  if (!normalized.includes('@')) return []
  return store.contacts.filter((c) => c.email && normalizeEmail(c.email) === normalized)
}

function pickContactForQuickAdd(
  matches: CreatorContact[],
  preferredCreatorId: string | null
): CreatorContact | undefined {
  if (matches.length === 0) return undefined
  if (preferredCreatorId) {
    const onCreator = matches.find((c) => c.creatorId === preferredCreatorId)
    if (onCreator) return onCreator
  }
  const linked = matches.find((c) => c.creatorId)
  if (linked) return linked
  return matches[0]
}

function findCreatorByDisplayName(
  store: CreatorOutreachStore,
  displayName: string
): CreatorPerson | undefined {
  const key = displayName.trim().toLowerCase()
  if (!key) return undefined
  return store.creators.find((c) => c.displayName.trim().toLowerCase() === key)
}

export type QuickAddPlan = {
  profile:
    | { action: 'existing'; profile: SocialMediaProfile }
    | { action: 'create' }
  contact:
    | { action: 'skip'; reason: 'no_email' }
    | { action: 'link'; contact: CreatorContact }
    | { action: 'create'; draft: DraftContactFromProfile }
  creator:
    | { action: 'link'; creator: CreatorPerson; reason: string }
    | { action: 'create'; displayName: string }
}

export function planQuickAdd(
  store: CreatorOutreachStore,
  input: {
    platform: OutreachPlatform
    handle: string
    displayName: string
    draftContact?: DraftContactFromProfile | null
  }
): QuickAddPlan {
  const handle = normalizeHandle(input.handle)
  const displayName = input.displayName.trim() || handle
  const existingProfile = findProfileByPlatformHandle(store, input.platform, handle)

  const profilePlan: QuickAddPlan['profile'] = existingProfile
    ? { action: 'existing', profile: existingProfile }
    : { action: 'create' }

  const crossPlatformSibling = findCrossPlatformProfileByHandle(
    store,
    input.platform,
    handle
  )

  const preferredCreatorId =
    existingProfile?.creatorId ?? crossPlatformSibling?.creatorId ?? null

  let contactPlan: QuickAddPlan['contact'] = { action: 'skip', reason: 'no_email' }
  const email = input.draftContact?.email?.trim()
  if (email) {
    const matches = findContactsByEmail(store, email)
    const picked = pickContactForQuickAdd(matches, preferredCreatorId)
    if (picked) {
      contactPlan = { action: 'link', contact: picked }
    } else if (input.draftContact) {
      contactPlan = { action: 'create', draft: input.draftContact }
    }
  }

  let creatorPlan: QuickAddPlan['creator']

  if (existingProfile?.creatorId) {
    const creator = store.creators.find((c) => c.id === existingProfile.creatorId)
    if (creator) {
      creatorPlan = {
        action: 'link',
        creator,
        reason: 'Profile already linked to this creator',
      }
    } else {
      creatorPlan = { action: 'create', displayName }
    }
  } else if (contactPlan.action === 'link' && contactPlan.contact.creatorId) {
    const creator = store.creators.find((c) => c.id === contactPlan.contact.creatorId)
    if (creator) {
      creatorPlan = {
        action: 'link',
        creator,
        reason: 'Contact with this email is already on this creator',
      }
    } else {
      creatorPlan = { action: 'create', displayName }
    }
  } else {
    const crossPlatform = findCreatorForCrossPlatformHandle(
      store,
      input.platform,
      handle
    )
    if (crossPlatform) {
      const { creator, sibling } = crossPlatform
      creatorPlan = {
        action: 'link',
        creator,
        reason: `Same @${handle} on ${platformLabel(sibling.platform)} (${sibling.handle})`,
      }
    } else {
      const byName = findCreatorByDisplayName(store, displayName)
      if (byName) {
        creatorPlan = {
          action: 'link',
          creator: byName,
          reason: 'Creator with matching display name',
        }
      } else {
        creatorPlan = { action: 'create', displayName }
      }
    }
  }

  return { profile: profilePlan, contact: contactPlan, creator: creatorPlan }
}

export function quickAddPlanLines(plan: QuickAddPlan): {
  profile: string
  contact: string
  creator: string
} {
  const profile =
    plan.profile.action === 'existing'
      ? `Use existing @${plan.profile.profile.handle} (${plan.profile.profile.platform})`
      : 'Create new profile'

  let contact: string
  if (plan.contact.action === 'skip') {
    contact = 'No email on profile — skip contact'
  } else if (plan.contact.action === 'link') {
    contact = `Link contact “${plan.contact.contact.name}” (${plan.contact.contact.email})`
  } else {
    contact = `Create contact ${plan.contact.draft.email}`
  }

  const creator =
    plan.creator.action === 'link'
      ? `Link creator “${plan.creator.creator.displayName}” (${plan.creator.reason})`
      : `Create creator “${plan.creator.displayName}”`

  return { profile, contact, creator }
}

export type QuickAddProfileInput = ScoutProfileInput & {
  /** When set, apply this plan instead of re-planning on the server. */
  plan?: QuickAddPlan
}

export function quickAddProfile(
  store: CreatorOutreachStore,
  input: QuickAddProfileInput
): {
  store: CreatorOutreachStore
  profile: SocialMediaProfile
  contactFromDraft?: CreatorContact
  emailReadyContactId?: string
} {
  const handle = normalizeHandle(input.handle)
  const platform = input.platform
  const displayName = input.displayName?.trim() || handle
  const plan =
    input.plan ??
    planQuickAdd(store, {
      platform,
      handle,
      displayName,
      draftContact: input.draftContact,
    })

  let creatorId: string | null = null
  if (plan.creator.action === 'link') {
    creatorId = plan.creator.creator.id
  } else {
    const creator = createCreator(store, plan.creator.displayName)
    creatorId = creator.id
  }

  let profile: SocialMediaProfile
  if (plan.profile.action === 'existing') {
    profile = plan.profile.profile
    updateProfile(store, profile.id, {
      displayName: displayName || profile.displayName,
      followerCount: input.followerCount ?? profile.followerCount,
      notes: input.notes?.trim() ? input.notes.trim() : profile.notes,
    })
    if (!profile.creatorId && creatorId) {
      linkProfileToCreator(store, profile.id, creatorId)
      profile.creatorId = creatorId
    }
  } else {
    const profileUrl =
      input.profileUrl?.trim() ||
      (platform === 'tiktok'
        ? `https://www.tiktok.com/@${handle}`
        : `https://www.instagram.com/${handle}`)

    profile = {
      id: crypto.randomUUID(),
      platform,
      handle,
      displayName,
      profileUrl,
      avatarUrl: null,
      followerCount: input.followerCount ?? null,
      creatorId,
      notes: input.notes?.trim() ?? '',
      scoutedAt: new Date().toISOString(),
      scoutedBy: input.scoutedBy?.trim() ?? '',
    }
    store.profiles.unshift(profile)
    store.activity.unshift({
      id: crypto.randomUUID(),
      type: 'profile_scouted',
      message: `Quick added @${handle} on ${platform === 'tiktok' ? 'TikTok' : 'Instagram'}`,
      createdAt: new Date().toISOString(),
    })
  }

  let contactFromDraft: CreatorContact | undefined
  let emailReadyContactId: string | undefined

  if (plan.contact.action === 'link') {
    const contact = plan.contact.contact
    if (contact.creatorId !== creatorId && creatorId) {
      linkContactToCreator(store, contact.id, creatorId)
      contact.creatorId = creatorId
    }
    registerTouchpointForQuickAdd(store, contact.email, profile.id, contact.id, creatorId)
    contactFromDraft = contact
    if (contact.email) {
      emailReadyContactId = contact.id
    }
  } else if (plan.contact.action === 'create' && creatorId) {
    const normalized = normalizeEmail(plan.contact.draft.email)
    const duplicateOnCreator = store.contacts.some(
      (c) => c.creatorId === creatorId && normalizeEmail(c.email) === normalized
    )
    if (!duplicateOnCreator) {
      const kind = inferCreatorContactKind(
        store,
        creatorId,
        normalized,
        plan.contact.draft.name
      )
      const result = addCreatorContact(store, {
        creatorId,
        kind,
        name: plan.contact.draft.name.trim() || displayName,
        email: normalized,
        notes: draftContactNotes(plan.contact.draft, platform, handle),
        linkedProfileId: profile.id,
      })
      Object.assign(store, result.store)
      contactFromDraft = result.contact
      emailReadyContactId = result.emailReadyContactId
    }
  }

  if (plan.profile.action === 'create' && creatorId && !profile.creatorId) {
    linkProfileToCreator(store, profile.id, creatorId)
  }

  return { store, profile, contactFromDraft, emailReadyContactId }
}

function registerTouchpointForQuickAdd(
  store: CreatorOutreachStore,
  email: string,
  profileId: string,
  contactId: string,
  creatorId: string | null
): void {
  const normalized = normalizeEmail(email)
  const exists = store.emailTouchpoints.some(
    (t) =>
      normalizeEmail(t.email) === normalized &&
      t.profileId === profileId &&
      t.contactId === contactId &&
      t.creatorId === creatorId
  )
  if (exists) return
  store.emailTouchpoints.unshift({
    id: crypto.randomUUID(),
    email: normalized,
    profileId,
    contactId,
    creatorId,
    addedAt: new Date().toISOString(),
  })
}

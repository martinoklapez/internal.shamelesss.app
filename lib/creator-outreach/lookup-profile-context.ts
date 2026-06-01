import { parseSocialProfileUrl, type ParsedSocialProfileUrl } from '@/lib/social-profile-url'
import {
  getProfilesForCreator,
  resolveCreatorAvatarImageSrc,
} from './creator-avatar'
import { findProfileByPlatformHandle } from './quick-add'
import type {
  ContactCrmStatus,
  CreatorContact,
  CreatorContactKind,
  CreatorOutreachStore,
  CreatorPerson,
  OutreachPlatform,
  SocialMediaProfile,
} from './types'

export type ProfileContextProfileDto = {
  id: string
  platform: OutreachPlatform
  handle: string
  displayName: string
  profileUrl: string
  avatarUrl: string | null
  followerCount: number | null
  creatorId: string | null
  notes: string
  scoutedAt: string
}

export type ProfileContextCreatorDto = {
  id: string
  displayName: string
  status: ContactCrmStatus
  notes: string
  avatarImageSrc: string
}

export type ProfileContextContactDto = {
  id: string
  name: string
  email: string
  kind: CreatorContactKind
  status: ContactCrmStatus
}

export type ProfileContextResponse = {
  tabUrl: string
  parsed: ParsedSocialProfileUrl | null
  isProfilePage: boolean
  profile: ProfileContextProfileDto | null
  creator: ProfileContextCreatorDto | null
  linkedProfiles: ProfileContextProfileDto[]
  contacts: ProfileContextContactDto[]
}

function toProfileDto(profile: SocialMediaProfile): ProfileContextProfileDto {
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
    scoutedAt: profile.scoutedAt,
  }
}

function toCreatorDto(
  creator: CreatorPerson,
  linkedProfiles: SocialMediaProfile[]
): ProfileContextCreatorDto {
  return {
    id: creator.id,
    displayName: creator.displayName,
    status: creator.status,
    notes: creator.notes,
    avatarImageSrc: resolveCreatorAvatarImageSrc(creator, linkedProfiles),
  }
}

function toContactDto(contact: CreatorContact): ProfileContextContactDto {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    kind: contact.kind,
    status: contact.status,
  }
}

export function lookupProfileContext(
  store: CreatorOutreachStore,
  tabUrl: string
): ProfileContextResponse {
  const parsed = parseSocialProfileUrl(tabUrl)
  if (!parsed) {
    return {
      tabUrl,
      parsed: null,
      isProfilePage: false,
      profile: null,
      creator: null,
      linkedProfiles: [],
      contacts: [],
    }
  }

  const profile = findProfileByPlatformHandle(store, parsed.platform, parsed.handle)
  if (!profile) {
    return {
      tabUrl,
      parsed,
      isProfilePage: true,
      profile: null,
      creator: null,
      linkedProfiles: [],
      contacts: [],
    }
  }

  const profileDto = toProfileDto(profile)
  if (!profile.creatorId) {
    return {
      tabUrl,
      parsed,
      isProfilePage: true,
      profile: profileDto,
      creator: null,
      linkedProfiles: [],
      contacts: [],
    }
  }

  const creator = store.creators.find((c) => c.id === profile.creatorId) ?? null
  const linkedProfiles = getProfilesForCreator(store, profile.creatorId)
  const contacts = store.contacts.filter((c) => c.creatorId === profile.creatorId)

  return {
    tabUrl,
    parsed,
    isProfilePage: true,
    profile: profileDto,
    creator: creator ? toCreatorDto(creator, linkedProfiles) : null,
    linkedProfiles: linkedProfiles.map(toProfileDto),
    contacts: contacts.map(toContactDto),
  }
}

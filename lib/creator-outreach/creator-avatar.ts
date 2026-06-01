import type { CreatorOutreachStore, CreatorPerson, SocialMediaProfile } from './types'

export function sortProfilesByScoutedAt(profiles: SocialMediaProfile[]): SocialMediaProfile[] {
  return [...profiles].sort((a, b) => a.scoutedAt.localeCompare(b.scoutedAt))
}

export function getProfilesForCreator(
  store: CreatorOutreachStore,
  creatorId: string
): SocialMediaProfile[] {
  return sortProfilesByScoutedAt(
    store.profiles.filter((p) => p.creatorId === creatorId)
  )
}

export function buildProfilesByCreatorIdMap(
  store: CreatorOutreachStore
): Map<string, SocialMediaProfile[]> {
  const byCreator = new Map<string, SocialMediaProfile[]>()
  for (const profile of store.profiles) {
    if (!profile.creatorId) continue
    const list = byCreator.get(profile.creatorId) ?? []
    list.push(profile)
    byCreator.set(profile.creatorId, list)
  }
  for (const [creatorId, list] of byCreator) {
    byCreator.set(creatorId, sortProfilesByScoutedAt(list))
  }
  return byCreator
}

/** Profile whose picture is used for the creator (manual pick or first linked). */
export function resolveCreatorAvatarProfile(
  creator: CreatorPerson,
  profiles: SocialMediaProfile[]
): SocialMediaProfile | null {
  const sorted = sortProfilesByScoutedAt(profiles)
  if (sorted.length === 0) return null

  if (creator.avatarProfileId) {
    const chosen = sorted.find((p) => p.id === creator.avatarProfileId)
    if (chosen) return chosen
  }

  return sorted[0]
}

export function creatorPlaceholderAvatarUrl(creatorId: string): string {
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(creatorId)}`
}

/** Image URL for creator avatars: linked profile photo, else Dicebear placeholder. */
export function resolveCreatorAvatarImageSrc(
  creator: CreatorPerson,
  profiles: SocialMediaProfile[]
): string {
  const profile = resolveCreatorAvatarProfile(creator, profiles)
  const stored = profile?.avatarUrl?.trim()
  if (stored) return stored
  return creatorPlaceholderAvatarUrl(creator.id)
}

export function isCreatorAvatarProfileSelected(
  creator: CreatorPerson,
  profile: SocialMediaProfile,
  sortedProfiles: SocialMediaProfile[]
): boolean {
  if (sortedProfiles.length === 0) return false
  if (creator.avatarProfileId) {
    return creator.avatarProfileId === profile.id
  }
  return sortedProfiles[0].id === profile.id
}

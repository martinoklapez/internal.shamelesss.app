import type { OutreachPlatform } from '@/lib/creator-outreach/types'
import {
  getInstagramProfileViaApify,
  getTikTokProfileViaApify,
  isApifySocialProfileConfigured,
} from '@/lib/apify/social-profile'
import { getInstagramProfile } from '@/lib/instagram-scraper'
import { getTikTokProfile } from '@/lib/tiktok-scraper'
import {
  buildDraftContactFromProfileMeta,
  type DraftContactFromProfile,
} from '@/lib/social-profile-draft-contact'

export type ResolvedSocialProfile = {
  platform: OutreachPlatform
  username: string
  name: string
  profilePicture: string | null
  followerCount: number | null
  profileUrl: string
  biography: string | null
  draftContact: DraftContactFromProfile | null
}

type FetchedProfileMeta = {
  username: string
  name: string
  profilePicture: string | null
  followerCount: number | null
  biography?: string | null
  businessEmail?: string | null
  publicEmail?: string | null
}

export const SUPPORTED_SOCIAL_PROFILE_URL_MESSAGE =
  'Paste a TikTok profile URL (https://www.tiktok.com/@username) or Instagram profile URL (https://www.instagram.com/username).'

export type ParsedSocialProfileUrl = {
  platform: OutreachPlatform
  handle: string
  profileUrl: string
}

export function parseSocialProfileUrl(input: string): ParsedSocialProfileUrl | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (!/^https?:\/\//i.test(trimmed)) return null

  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, '')
    const path = url.pathname

    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
      const match = path.match(/^\/@([^/?#]+)/)
      if (match) {
        const handle = match[1]
        return {
          platform: 'tiktok',
          handle,
          profileUrl: `https://www.tiktok.com/@${handle}`,
        }
      }
    }

    if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
      const segments = path.split('/').filter(Boolean)
      const blocked = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'accounts'])
      if (segments.length > 0 && !blocked.has(segments[0])) {
        const handle = segments[0].replace(/^@/, '')
        return {
          platform: 'instagram',
          handle,
          profileUrl: `https://www.instagram.com/${handle}/`,
        }
      }
    }
  } catch {
    return null
  }

  return null
}

export function validateSocialProfileUrl(
  input: string
): { ok: true; parsed: ParsedSocialProfileUrl } | { ok: false; error: string } {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: 'Profile URL is required.' }
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: SUPPORTED_SOCIAL_PROFILE_URL_MESSAGE }
  }
  const parsed = parseSocialProfileUrl(trimmed)
  if (!parsed) {
    return { ok: false, error: SUPPORTED_SOCIAL_PROFILE_URL_MESSAGE }
  }
  return { ok: true, parsed }
}

async function fetchSocialProfileMetadata(
  platform: OutreachPlatform,
  profileUrl: string,
  handle: string
): Promise<FetchedProfileMeta | null> {
  if (isApifySocialProfileConfigured()) {
    try {
      const viaApify =
        platform === 'tiktok'
          ? await getTikTokProfileViaApify(handle)
          : await getInstagramProfileViaApify(handle)
      if (viaApify) return viaApify
    } catch (error) {
      console.warn(
        `Apify ${platform} profile scrape failed for @${handle}, using direct fetch`,
        error
      )
    }
  }

  return platform === 'tiktok'
    ? await getTikTokProfile(profileUrl)
    : await getInstagramProfile(profileUrl)
}

export async function resolveSocialProfileFromUrl(
  input: string
): Promise<ResolvedSocialProfile | null> {
  const parsed = parseSocialProfileUrl(input)
  if (!parsed) return null

  const fetched = await fetchSocialProfileMetadata(
    parsed.platform,
    parsed.profileUrl,
    parsed.handle
  )

  const username = fetched?.username ?? parsed.handle
  const name = fetched?.name ?? parsed.handle
  const profilePicture = fetched?.profilePicture ?? null
  const followerCount = fetched?.followerCount ?? null
  const biography = fetched?.biography ?? null

  const draftContact = buildDraftContactFromProfileMeta({
    platform: parsed.platform,
    displayName: name,
    handle: username,
    biography,
    businessEmail: fetched?.businessEmail,
    publicEmail: fetched?.publicEmail,
  })

  return {
    platform: parsed.platform,
    username,
    name,
    profilePicture,
    followerCount,
    profileUrl: parsed.profileUrl,
    biography,
    draftContact,
  }
}

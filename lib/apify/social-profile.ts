import { runApifyActorSyncGetDatasetItems, getApifyApiToken } from '@/lib/apify/client'
import { getTikTokProfileViaApify } from '@/lib/apify/tiktok-profile'
import { normalizeFollowerCount } from '@/lib/normalize-follower-count'
import type { InstagramProfile } from '@/lib/instagram-scraper'
import type { TikTokProfile } from '@/lib/tiktok-scraper'

/** @see https://apify.com/apify/instagram-profile-scraper */
const DEFAULT_INSTAGRAM_ACTOR = 'apify/instagram-profile-scraper'

function instagramActorId(): string {
  return process.env.APIFY_INSTAGRAM_PROFILE_ACTOR_ID?.trim() || DEFAULT_INSTAGRAM_ACTOR
}

export function isApifySocialProfileConfigured(): boolean {
  return Boolean(getApifyApiToken())
}

type InstagramApifyItem = {
  username?: string
  fullName?: string
  profilePicUrl?: string
  profilePicUrlHD?: string
  biography?: string
  bio?: string
  businessEmail?: string
  business_email?: string
  publicEmail?: string
  public_email?: string
  email?: string
  followersCount?: number
  followerCount?: number
  followers_count?: number
  error?: string
  errorDescription?: string
}

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').trim()
}

export async function getInstagramProfileViaApify(
  handle: string
): Promise<InstagramProfile | null> {
  const username = normalizeHandle(handle)
  if (!username) return null

  const items = await runApifyActorSyncGetDatasetItems<InstagramApifyItem>(
    instagramActorId(),
    {
      usernames: [username],
      includeAboutSection: true,
    }
  )

  const row =
    items.find((item) => item.username?.toLowerCase() === username.toLowerCase()) ??
    items.find((item) => !item.error) ??
    items[0]

  if (!row || row.error) {
    console.warn(
      `Apify Instagram profile scrape failed for @${username}:`,
      row?.error ?? row?.errorDescription ?? 'no results'
    )
    return null
  }

  const scrapedUsername = row.username?.trim() || username
  const fullName = row.fullName?.trim()
  const profilePicture = row.profilePicUrlHD ?? row.profilePicUrl ?? null
  const biography = row.biography?.trim() || row.bio?.trim() || null
  const businessEmail =
    row.businessEmail?.trim() ||
    row.business_email?.trim() ||
    row.email?.trim() ||
    null
  const publicEmail = row.publicEmail?.trim() || row.public_email?.trim() || null
  const followerCount = normalizeFollowerCount(
    row.followersCount ?? row.followerCount ?? row.followers_count
  )

  return {
    username: scrapedUsername,
    name: fullName && fullName !== scrapedUsername ? fullName : scrapedUsername,
    profilePicture,
    followerCount,
    biography,
    businessEmail,
    publicEmail,
  }
}

export { getTikTokProfileViaApify }

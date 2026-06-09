import { runApifyActorSyncGetDatasetItems } from '@/lib/apify/client'
import { readRuntimeEnv } from '@/lib/runtime/env'
import { extractEmailsFromText } from '@/lib/extract-emails-from-text'
import { normalizeFollowerCount } from '@/lib/normalize-follower-count'
import type { TikTokProfile } from '@/lib/tiktok-scraper'

/**
 * Profile-focused actor — one row per video with `authorMeta` on each.
 * @see https://apify.com/clockworks/tiktok-profile-scraper
 */
export const DEFAULT_TIKTOK_PROFILE_ACTOR = 'clockworks/tiktok-profile-scraper'

/**
 * General scraper — also accepts `profiles: ["handle"]` with the same output shape.
 * @see https://apify.com/clockworks/tiktok-scraper
 */
export const DEFAULT_TIKTOK_SCRAPER_ACTOR = 'clockworks/tiktok-scraper'

export function tiktokProfileActorId(): string {
  return readRuntimeEnv('APIFY_TIKTOK_PROFILE_ACTOR_ID') || DEFAULT_TIKTOK_PROFILE_ACTOR
}

export function tiktokScraperActorId(): string {
  return readRuntimeEnv('APIFY_TIKTOK_SCRAPER_ACTOR_ID') || DEFAULT_TIKTOK_SCRAPER_ACTOR
}

export type TikTokAuthorMeta = {
  name?: string
  nickName?: string
  avatar?: string
  originalAvatarUrl?: string
  signature?: string
  bio?: string
  bioLink?: string | null
  fans?: number
  followerCount?: number
  followers?: number
}

export type TikTokApifyItem = {
  authorMeta?: TikTokAuthorMeta
  error?: string
  errorCode?: string
  input?: string
  url?: string
}

const TIKTOK_DOWNLOAD_FLAGS = {
  shouldDownloadVideos: false,
  shouldDownloadCovers: false,
  shouldDownloadSlideshowImages: false,
  shouldDownloadSubtitles: false,
  shouldDownloadAvatars: false,
  shouldDownloadMusicCovers: false,
} as const

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').trim()
}

function handleMatches(meta: TikTokAuthorMeta, handle: string): boolean {
  const key = handle.toLowerCase()
  const name = meta.name?.trim().toLowerCase()
  const nick = meta.nickName?.trim().toLowerCase()
  return name === key || nick === key
}

export function emailFromTikTokBioLink(bioLink: string | null | undefined): string | null {
  if (!bioLink?.trim()) return null
  const trimmed = bioLink.trim()
  if (trimmed.toLowerCase().startsWith('mailto:')) {
    const addr = trimmed.slice(7).split('?')[0]?.trim()
    return addr && addr.includes('@') ? addr.toLowerCase() : null
  }
  return extractEmailsFromText(trimmed)[0] ?? null
}

export function pickTikTokApifyItem(
  items: TikTokApifyItem[],
  handle: string
): TikTokApifyItem | undefined {
  const valid = items.filter((item) => !item.errorCode && !item.error && item.authorMeta)
  if (valid.length === 0) return undefined

  const key = handle.toLowerCase()
  return (
    valid.find((item) => item.authorMeta && handleMatches(item.authorMeta, key)) ??
    valid[0]
  )
}

export function mapTikTokAuthorMetaToProfile(
  meta: TikTokAuthorMeta,
  fallbackHandle: string
): TikTokProfile {
  const username = (meta.name ?? fallbackHandle).trim()
  const display = (meta.nickName ?? meta.name ?? fallbackHandle).trim()
  const profilePicture = meta.avatar?.trim() || meta.originalAvatarUrl?.trim() || null
  const biography = meta.signature?.trim() || meta.bio?.trim() || null
  const businessEmail = emailFromTikTokBioLink(meta.bioLink)

  return {
    username,
    name: display && display !== username ? display : username,
    profilePicture,
    followerCount: normalizeFollowerCount(
      meta.fans ?? meta.followerCount ?? meta.followers
    ),
    biography,
    businessEmail,
    publicEmail: null,
  }
}

function profileScrapeInput(handle: string): Record<string, unknown> {
  return {
    profiles: [handle],
    resultsPerPage: 1,
    ...TIKTOK_DOWNLOAD_FLAGS,
  }
}

function scraperProfileInput(handle: string): Record<string, unknown> {
  return {
    profiles: [handle],
    resultsPerPage: 1,
    profileScrapeSections: ['videos'],
    profileSorting: 'latest',
    excludePinnedPosts: false,
    ...TIKTOK_DOWNLOAD_FLAGS,
  }
}

async function runTikTokActor(
  actorId: string,
  input: Record<string, unknown>,
  handle: string
): Promise<TikTokProfile | null> {
  const items = await runApifyActorSyncGetDatasetItems<TikTokApifyItem>(actorId, input)
  const row = pickTikTokApifyItem(items, handle)

  if (!row) {
    const err = items.find((item) => item.errorCode || item.error)
    if (err) {
      console.warn(
        `Apify TikTok (${actorId}) for @${handle}:`,
        err.errorCode ?? err.error ?? 'no results'
      )
    }
    return null
  }

  const meta = row.authorMeta
  if (!meta) return null
  return mapTikTokAuthorMetaToProfile(meta, handle)
}

/**
 * Scrape a TikTok profile via Clockworks Apify actors (profile scraper, then tiktok-scraper).
 */
export async function getTikTokProfileViaApify(handle: string): Promise<TikTokProfile | null> {
  const profile = normalizeHandle(handle)
  if (!profile) return null

  const profileActor = tiktokProfileActorId()
  try {
    const fromProfileActor = await runTikTokActor(profileActor, profileScrapeInput(profile), profile)
    if (fromProfileActor) return fromProfileActor
  } catch (error) {
    console.warn(`Apify TikTok profile actor failed for @${profile}:`, error)
  }

  const scraperActor = tiktokScraperActorId()
  if (scraperActor === profileActor) return null

  try {
    return await runTikTokActor(scraperActor, scraperProfileInput(profile), profile)
  } catch (error) {
    console.warn(`Apify TikTok scraper actor failed for @${profile}:`, error)
    return null
  }
}

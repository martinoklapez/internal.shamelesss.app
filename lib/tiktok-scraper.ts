import { normalizeFollowerCount } from '@/lib/normalize-follower-count'

const TIKTOK_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
} as const

export type TikTokProfile = {
  username: string
  name: string
  profilePicture: string | null
  followerCount: number | null
  biography?: string | null
  /** Email from bio link (mailto / link-in-bio) when Apify returns it. */
  businessEmail?: string | null
  publicEmail?: string | null
}

/** Extract handle from `https://www.tiktok.com/@handle` or return bare handle. */
export function parseTikTokHandle(input: string): string {
  const trimmed = input.trim().replace(/^@/, '')
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const path = new URL(trimmed).pathname
      const match = path.match(/^\/@([^/?#]+)/)
      if (match) return match[1]
    }
  } catch {
    // fall through
  }
  return trimmed.split('/').pop()?.replace(/^@/, '') ?? trimmed
}

type TikTokUserBlob = {
  uniqueId?: string
  nickname?: string
  signature?: string
  followerCount?: number
  fans?: number
  stats?: { followerCount?: number; follower?: number; fans?: number }
  avatarLarger?: string
  avatarMedium?: string
  avatarThumb?: string
}

function followerCountFromTikTokUser(user: TikTokUserBlob): number | null {
  return normalizeFollowerCount(
    user.followerCount ??
      user.fans ??
      user.stats?.followerCount ??
      user.stats?.follower ??
      user.stats?.fans
  )
}

function extractTikTokFollowerCountFromHtml(html: string): number | null {
  const match =
    html.match(/"followerCount"\s*:\s*(\d+)/) ??
    html.match(/"fans"\s*:\s*(\d+)/)
  if (!match?.[1]) return null
  return normalizeFollowerCount(Number(match[1]))
}

function extractUserFromUniversalData(data: Record<string, unknown>): TikTokUserBlob | null {
  const scope = (data.__DEFAULT_SCOPE__ ?? data.defaultScope) as Record<string, unknown> | undefined
  if (!scope) return null

  const detail =
    (scope['webapp.user-detail'] as Record<string, unknown> | undefined) ??
    ((scope.webapp as Record<string, unknown> | undefined)?.['user-detail'] as
      | Record<string, unknown>
      | undefined)

  const userInfo = detail?.userInfo as Record<string, unknown> | undefined
  const user = (userInfo?.user ?? userInfo) as TikTokUserBlob | undefined
  if (user?.uniqueId || user?.nickname) return user

  // Legacy path used by older scraper versions
  const legacy = (scope.webapp as Record<string, unknown> | undefined)?.user as
    | Record<string, unknown>
    | undefined
  const legacyInfo = legacy?.userInfo as Record<string, unknown> | undefined
  const legacyUser = (legacyInfo?.user ?? legacyInfo) as TikTokUserBlob | undefined
  return legacyUser?.uniqueId || legacyUser?.nickname ? legacyUser : null
}

export function parseTikTokProfileFromHtml(html: string, fallbackHandle: string): TikTokProfile | null {
  const universalDataMatch = html.match(
    /<script[^>]*id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/
  )
  if (universalDataMatch) {
    try {
      const data = JSON.parse(universalDataMatch[1]) as Record<string, unknown>
      const user = extractUserFromUniversalData(data)
      if (user) {
        return {
          username: (user.uniqueId ?? fallbackHandle).trim(),
          name: (user.nickname ?? user.uniqueId ?? fallbackHandle).trim(),
          profilePicture:
            user.avatarLarger ?? user.avatarMedium ?? user.avatarThumb ?? null,
          followerCount: followerCountFromTikTokUser(user),
          biography: user.signature?.trim() || null,
        }
      }
    } catch {
      // continue to fallbacks
    }
  }

  const nicknameMatch = html.match(/"uniqueId"\s*:\s*"([^"]+)"[\s\S]*?"nickname"\s*:\s*"([^"]+)"/)
  if (nicknameMatch) {
    const avatarMatch = html.match(
      /"avatarLarger"\s*:\s*"(https:[^"\\]+(?:\\.[^"\\]*)*)"/
    )
    return {
      username: nicknameMatch[1].trim(),
      name: nicknameMatch[2].trim(),
      profilePicture: avatarMatch?.[1]?.replace(/\\u002F/g, '/') ?? null,
      followerCount: extractTikTokFollowerCountFromHtml(html),
    }
  }

  const metaNameMatch = html.match(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
  )
  if (metaNameMatch) {
    const title = metaNameMatch[1]
    const nameMatch = title.match(/^([^(]+?)(?:\s*\(@[^)]+\))?\s*\|/i)
    if (nameMatch) {
      const name = nameMatch[1].trim()
      if (name && name !== fallbackHandle) {
        return {
          username: fallbackHandle,
          name,
          profilePicture: null,
          followerCount: extractTikTokFollowerCountFromHtml(html),
        }
      }
    }
  }

  return null
}

/**
 * Fetch public TikTok profile metadata (username, display name, avatar URL).
 * Accepts a handle, @handle, or full profile URL.
 */
export async function getTikTokProfile(
  usernameOrUrl: string
): Promise<TikTokProfile | null> {
  try {
    const cleanUsername = parseTikTokHandle(usernameOrUrl)
    const response = await fetch(`https://www.tiktok.com/@${cleanUsername}`, {
      headers: TIKTOK_FETCH_HEADERS,
    })

    if (!response.ok) {
      console.error(
        `Failed to fetch TikTok profile: ${response.status} ${response.statusText}`
      )
      return null
    }

    const html = await response.text()
    const profile = parseTikTokProfileFromHtml(html, cleanUsername)
    if (!profile) {
      console.warn(`Could not extract TikTok profile for @${cleanUsername}`)
    }
    return profile
  } catch (error) {
    console.error(`Error fetching TikTok profile for ${usernameOrUrl}:`, error)
    return null
  }
}

/**
 * Fetch TikTok display name from a username/handle or profile URL.
 */
export async function getTikTokAccountName(username: string): Promise<string | null> {
  const profile = await getTikTokProfile(username)
  return profile?.name ?? null
}

import { normalizeFollowerCount } from '@/lib/normalize-follower-count'

const INSTAGRAM_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
} as const

export type InstagramProfile = {
  username: string
  name: string
  profilePicture: string | null
  followerCount: number | null
  biography?: string | null
  businessEmail?: string | null
  publicEmail?: string | null
}

function unescapeInstagramJsonString(raw: string): string {
  return raw
    .replace(/\\u0026/g, '&')
    .replace(/\\u0040/g, '@')
    .replace(/\\\//g, '/')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .trim()
}

function extractInstagramJsonString(html: string, field: string): string | null {
  const match = html.match(new RegExp(`"${field}":"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`))
  if (!match?.[1]) return null
  const value = unescapeInstagramJsonString(match[1])
  return value || null
}

function extractInstagramJsonNumber(html: string, field: string): number | null {
  const match = html.match(new RegExp(`"${field}":(\\d+)`))
  if (!match?.[1]) return null
  return normalizeFollowerCount(Number(match[1]))
}

function extractInstagramFollowerCount(html: string): number | null {
  return (
    extractInstagramJsonNumber(html, 'followersCount') ??
    extractInstagramJsonNumber(html, 'followerCount') ??
    extractInstagramJsonNumber(html, 'followers_count')
  )
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#064;/g, '@')
}

/** Extract handle from profile URL or bare username. */
export function parseInstagramHandle(input: string): string {
  const trimmed = input.trim().replace(/^@/, '')
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const { pathname } = new URL(trimmed)
      const segments = pathname.split('/').filter(Boolean)
      const blocked = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'accounts'])
      if (segments.length > 0 && !blocked.has(segments[0])) {
        return segments[0].replace(/^@/, '')
      }
    }
  } catch {
    // fall through
  }
  return trimmed.split('/').filter(Boolean).pop()?.replace(/^@/, '') ?? trimmed
}

export function parseInstagramProfileFromHtml(
  html: string,
  fallbackHandle: string
): InstagramProfile | null {
  const metaContent = (property: string) => {
    const match = html.match(
      new RegExp(
        `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`,
        'i'
      )
    )
    return match?.[1] ? decodeHtmlEntities(match[1]) : null
  }

  const ogTitle = metaContent('og:title')
  const ogImage = metaContent('og:image')

  let name: string | null = null
  let username = fallbackHandle

  if (ogTitle) {
    const titleMatch = ogTitle.match(/^([^(•]+?)(?:\s*\(@([^)]+)\))?\s*[•|]/i)
    if (titleMatch) {
      name = titleMatch[1].trim()
      if (titleMatch[2]) username = titleMatch[2].replace(/^@/, '').trim()
    }
  }

  const jsonLdMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g
  )
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1])
      if (data['@type'] === 'Person' || data['@type'] === 'ProfilePage') {
        if (data.name && !String(data.name).toLowerCase().includes('instagram')) {
          name = String(data.name).trim()
        }
        if (data.image) {
          const img =
            typeof data.image === 'string'
              ? data.image
              : Array.isArray(data.image)
                ? data.image[0]
                : data.image?.url
          if (img && !ogImage) {
            return {
              username,
              name: name ?? username,
              profilePicture: String(img),
              followerCount: extractInstagramFollowerCount(html),
            }
          }
        }
      }
    } catch {
      // continue
    }
  }

  const picMatch =
    html.match(/"profile_pic_url_hd":"([^"\\]+(?:\\.[^"\\]*)*)"/) ??
    html.match(/"profile_pic_url":"([^"\\]+(?:\\.[^"\\]*)*)"/)
  const profilePicture =
    ogImage ?? picMatch?.[1]?.replace(/\\u0026/g, '&').replace(/\\\//g, '/') ?? null

  const fullNameMatch = html.match(/"full_name":"([^"\\]+(?:\\.[^"\\]*)*)"/)
  if (fullNameMatch && !name) {
    name = fullNameMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/').trim()
  }

  const usernameMatch = html.match(/"username":"([^"\\]+)"/)
  if (usernameMatch) username = usernameMatch[1]

  const biography = extractInstagramJsonString(html, 'biography')
  const businessEmail =
    extractInstagramJsonString(html, 'business_email') ??
    extractInstagramJsonString(html, 'businessEmail')
  const publicEmail =
    extractInstagramJsonString(html, 'public_email') ??
    extractInstagramJsonString(html, 'publicEmail')
  const followerCount = extractInstagramFollowerCount(html)

  if (
    !name &&
    !profilePicture &&
    username === fallbackHandle &&
    !biography &&
    followerCount == null
  ) {
    return null
  }

  return {
    username,
    name: name && name !== username ? name : username,
    profilePicture,
    followerCount,
    biography,
    businessEmail,
    publicEmail,
  }
}

async function fetchInstagramProfileHtml(username: string): Promise<string | null> {
  const urls = [
    `https://www.instagram.com/${username}/`,
    `https://www.instagram.com/${username}/?hl=en`,
  ]
  const headers = {
    ...INSTAGRAM_FETCH_HEADERS,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  }

  for (const url of urls) {
    const response = await fetch(url, { headers })
    if (!response.ok) continue
    const html = await response.text()
    if (parseInstagramProfileFromHtml(html, username)) return html
  }
  return null
}

export async function getInstagramProfile(
  usernameOrUrl: string
): Promise<InstagramProfile | null> {
  try {
    const cleanUsername = parseInstagramHandle(usernameOrUrl)
    const html = await fetchInstagramProfileHtml(cleanUsername)
    if (!html) {
      console.warn(`Could not extract Instagram profile for @${cleanUsername}`)
      return null
    }
    return parseInstagramProfileFromHtml(html, cleanUsername)
  } catch (error) {
    console.error(`Error fetching Instagram profile for ${usernameOrUrl}:`, error)
    return null
  }
}

/**
 * Fetch Instagram display name from a username/handle or profile URL.
 */
export async function getInstagramAccountName(username: string): Promise<string | null> {
  const profile = await getInstagramProfile(username)
  return profile?.name ?? null
}

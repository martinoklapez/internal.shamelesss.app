const FETCH_HEADERS_BASE = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'image',
  'Sec-Fetch-Mode': 'no-cors',
} as const

const INSTAGRAM_HOST_PATTERNS = [
  /(^|\.)cdninstagram\.com$/i,
  /(^|\.)fbcdn\.net$/i,
  /(^|\.)instagram\.com$/i,
] as const

/** TikTok avatars use regional CDNs e.g. `p16-sign-va.tiktokcdn.com`, `….tiktokcdn-eu.com`. */
function isTikTokProfilePictureHost(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h.includes('tiktokcdn') ||
    /(^|\.)tiktokv\.com$/i.test(h) ||
    /(^|\.)tiktok\.com$/i.test(h) ||
    /(^|\.)byteoversea\.com$/i.test(h) ||
    /(^|\.)ibyteimg\.com$/i.test(h)
  )
}

export function isAllowedProfilePictureUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    if (isTikTokProfilePictureHost(host)) return true
    return INSTAGRAM_HOST_PATTERNS.some((pattern) => pattern.test(host))
  } catch {
    return false
  }
}

function isTikTokCdnUrl(url: string): boolean {
  try {
    return isTikTokProfilePictureHost(new URL(url).hostname.toLowerCase())
  } catch {
    return false
  }
}

function refererForProfilePictureUrl(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (
      host.includes('instagram') ||
      host.includes('cdninstagram') ||
      host.includes('fbcdn')
    ) {
      return 'https://www.instagram.com/'
    }
    if (host.includes('tiktok')) {
      return 'https://www.tiktok.com/'
    }
  } catch {
    // ignore
  }
  return undefined
}

export type ProfilePictureFetchResult = {
  bytes: Buffer
  contentType: string
}

/**
 * Download a profile picture from an allowed social CDN (server-side only).
 */
/** Same-origin proxy URL for UI preview (Instagram/TikTok CDNs block cross-origin img). */
export function profilePicturePreviewUrl(sourceUrl: string | null | undefined): string | null {
  const url = sourceUrl?.trim()
  if (!url) return null
  if (url.startsWith('/') || url.includes('creator-pipeline-avatars')) return url
  if (!isAllowedProfilePictureUrl(url)) return url
  return `/api/creator-outreach/avatar-proxy?url=${encodeURIComponent(url)}`
}

export async function fetchProfilePictureBytes(
  sourceUrl: string
): Promise<ProfilePictureFetchResult | null> {
  if (!isAllowedProfilePictureUrl(sourceUrl)) {
    console.error('Profile picture URL host not allowed:', sourceUrl)
    return null
  }

  const referer = refererForProfilePictureUrl(sourceUrl)
  const headers: Record<string, string> = { ...FETCH_HEADERS_BASE }
  if (referer) {
    headers.Referer = referer
    if (referer.includes('tiktok.com')) headers.Origin = 'https://www.tiktok.com'
  }

  try {
    const response = await fetch(sourceUrl, { headers, redirect: 'follow' })
    if (!response.ok) {
      console.error(
        `Profile picture download failed: ${response.status} ${response.statusText} (${sourceUrl.slice(0, 80)}…)`
      )
      return null
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const contentTypeLower = contentType.toLowerCase()
    const allowedType =
      contentTypeLower.startsWith('image/') ||
      (isTikTokCdnUrl(sourceUrl) &&
        (contentTypeLower.includes('octet-stream') || contentTypeLower === ''))
    if (!allowedType) {
      console.error(`Profile picture rejected: non-image content-type ${contentType}`)
      return null
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length === 0) {
      console.error('Profile picture rejected: empty body')
      return null
    }

    return { bytes, contentType }
  } catch (error) {
    console.error('Profile picture download error:', error)
    return null
  }
}

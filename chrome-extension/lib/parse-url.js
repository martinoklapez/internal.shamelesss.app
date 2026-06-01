/** Mirrors lib/social-profile-url.ts parseSocialProfileUrl for tab detection. */
export function parseSocialProfileUrl(input) {
  const trimmed = input.trim()
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null

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

export function platformLabel(platform) {
  return platform === 'tiktok' ? 'TikTok' : 'Instagram'
}

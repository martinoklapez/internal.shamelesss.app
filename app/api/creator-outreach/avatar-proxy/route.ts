import { NextRequest, NextResponse } from 'next/server'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'
import {
  fetchProfilePictureBytes,
  isAllowedProfilePictureUrl,
} from '@/lib/social-profile-picture-fetch'

export const dynamic = 'force-dynamic'

const MAX_PROXY_BYTES = 5 * 1024 * 1024

/** Proxy social CDN avatars for in-app preview (Instagram/TikTok block cross-origin <img>). */
export async function GET(request: NextRequest) {
  const auth = await requireCreatorCrmApi(request)
  if (auth instanceof NextResponse) return auth

  const sourceUrl = request.nextUrl.searchParams.get('url')?.trim()
  if (!sourceUrl || !isAllowedProfilePictureUrl(sourceUrl)) {
    return NextResponse.json({ error: 'Invalid or disallowed image URL' }, { status: 400 })
  }

  const fetched = await fetchProfilePictureBytes(sourceUrl)
  if (!fetched) {
    return NextResponse.json({ error: 'Could not fetch profile picture' }, { status: 502 })
  }

  if (fetched.bytes.length > MAX_PROXY_BYTES) {
    return NextResponse.json({ error: 'Image too large' }, { status: 413 })
  }

  const contentType = fetched.contentType.split(';')[0]?.trim() || 'image/jpeg'
  return new NextResponse(new Uint8Array(fetched.bytes), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',
    },
  })
}

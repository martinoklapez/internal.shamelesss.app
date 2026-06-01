import { NextRequest, NextResponse } from 'next/server'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'
import {
  resolveSocialProfileFromUrl,
  SUPPORTED_SOCIAL_PROFILE_URL_MESSAGE,
  validateSocialProfileUrl,
} from '@/lib/social-profile-url'

export async function POST(request: NextRequest) {
  const auth = await requireCreatorCrmApi(request)
  if (auth instanceof NextResponse) return auth

  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const url = body.url?.trim()
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const validation = validateSocialProfileUrl(url)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const profile = await resolveSocialProfileFromUrl(url)
  if (!profile) {
    return NextResponse.json({ error: SUPPORTED_SOCIAL_PROFILE_URL_MESSAGE }, { status: 400 })
  }

  return NextResponse.json(profile)
}

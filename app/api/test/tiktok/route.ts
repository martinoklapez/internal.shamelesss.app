import { NextRequest, NextResponse } from 'next/server'
import { getTikTokProfile, parseTikTokHandle } from '@/lib/tiktok-scraper'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const handle = searchParams.get('handle')
  const urlParam = searchParams.get('url')

  const input = urlParam ?? handle
  if (!input) {
    return NextResponse.json(
      { error: 'Provide handle or url query parameter' },
      { status: 400 }
    )
  }

  const cleanHandle = parseTikTokHandle(input)
  const profileUrl = `https://www.tiktok.com/@${cleanHandle}`

  try {
    const profile = await getTikTokProfile(input)
    if (!profile) {
      return NextResponse.json(
        {
          handle: cleanHandle,
          url: profileUrl,
          error: 'Could not extract profile from TikTok page',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      handle: cleanHandle,
      url: profileUrl,
      username: profile.username,
      name: profile.name,
      profilePicture: profile.profilePicture,
      accountName: profile.name,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Failed to fetch TikTok profile',
        message,
        handle: cleanHandle,
        url: profileUrl,
      },
      { status: 500 }
    )
  }
}

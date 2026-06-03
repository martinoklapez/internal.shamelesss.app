import { NextResponse } from 'next/server'

const GMAIL_MAIL_SIG_PATTERN =
  /^https:\/\/ci\d+\.googleusercontent\.com\/mail-sig\//i

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url')?.trim()
  if (!url || !GMAIL_MAIL_SIG_PATTERN.test(url)) {
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
  }

  let upstream: Response
  try {
    upstream = await fetch(url, {
      headers: { Referer: 'https://mail.google.com/' },
      cache: 'force-cache',
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Image unavailable (${upstream.status})` },
      { status: upstream.status === 429 ? 429 : 502 }
    )
  }

  const contentType = upstream.headers.get('content-type') ?? 'image/png'
  const buffer = await upstream.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

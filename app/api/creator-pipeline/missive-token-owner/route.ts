import { NextResponse } from 'next/server'
import { getMissiveTokenOwnerEmail } from '@/lib/creator-outreach/missive'

export async function GET() {
  const token = process.env.MISSIVE_API_TOKEN?.trim()
  if (!token) {
    return NextResponse.json({ error: 'MISSIVE_API_TOKEN not configured' }, { status: 503 })
  }

  const tokenOwnerEmail = await getMissiveTokenOwnerEmail(token)
  if (!tokenOwnerEmail) {
    return NextResponse.json({ error: 'Could not load Missive API user' }, { status: 502 })
  }

  return NextResponse.json({ tokenOwnerEmail })
}

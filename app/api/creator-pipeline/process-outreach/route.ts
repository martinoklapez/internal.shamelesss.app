import { NextResponse } from 'next/server'
import { processPendingOutreachEvents } from '@/lib/database/creator-pipeline/process-outreach-events'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CREATOR_OUTREACH_CRON_SECRET?.trim()
  if (!secret) return false
  const header = request.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true
  const query = new URL(request.url).searchParams.get('secret')
  return query === secret
}

export async function POST(request: Request) {
  let supabase
  let contactIds: string[] | undefined
  let attemptMissive: boolean | undefined

  if (isAuthorizedCron(request)) {
    try {
      supabase = getAdminSupabaseClient()
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Server not configured' },
        { status: 500 }
      )
    }
    try {
      const body = (await request.json().catch(() => ({}))) as {
        contactIds?: string[]
        attemptMissive?: boolean
      }
      contactIds = body.contactIds
      if (body.attemptMissive !== undefined) {
        attemptMissive = Boolean(body.attemptMissive)
      }
    } catch {
      // empty body ok for cron
    }
  } else {
    const auth = await requireCreatorCrmApi(request)
    if (auth instanceof NextResponse) return auth
    try {
      supabase = getAdminSupabaseClient()
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Server not configured' },
        { status: 500 }
      )
    }

    try {
      const body = (await request.json().catch(() => ({}))) as {
        contactIds?: string[]
        attemptMissive?: boolean
      }
      contactIds = body.contactIds
      if (body.attemptMissive !== undefined) {
        attemptMissive = Boolean(body.attemptMissive)
      }
    } catch {
      // empty body ok
    }
  }

  try {
    const result = await processPendingOutreachEvents(supabase, {
      contactIds,
      attemptMissive,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/creator-pipeline/process-outreach:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    )
  }
}

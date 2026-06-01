import { NextResponse } from 'next/server'
import { processPendingQuickAddJobs } from '@/lib/database/creator-pipeline/process-quick-add-jobs'
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
  let limit: number | undefined

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
      const body = (await request.json().catch(() => ({}))) as { limit?: number }
      if (body.limit !== undefined && Number.isFinite(body.limit)) {
        limit = Math.min(Math.max(1, Math.floor(body.limit)), 10)
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
      const body = (await request.json().catch(() => ({}))) as { limit?: number }
      if (body.limit !== undefined && Number.isFinite(body.limit)) {
        limit = Math.min(Math.max(1, Math.floor(body.limit)), 10)
      }
    } catch {
      // empty body ok
    }
  }

  try {
    const result = await processPendingQuickAddJobs(supabase, { limit })
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/creator-pipeline/process-quick-add:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    )
  }
}

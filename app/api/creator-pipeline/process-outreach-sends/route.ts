import { NextResponse } from 'next/server'
import { invokeOutreachSendsEdgeWorker } from '@/lib/creator-outreach/invoke-outreach-sends-edge-worker'
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

  if (isAuthorizedCron(request)) {
    try {
      supabase = getAdminSupabaseClient()
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Server not configured' },
        { status: 500 }
      )
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
  }

  try {
    const result = await invokeOutreachSendsEdgeWorker(supabase)
    if (!result) {
      return NextResponse.json(
        { error: 'Outreach send edge worker unavailable. Deploy process-creator-outreach-sends.' },
        { status: 503 }
      )
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/creator-pipeline/process-outreach-sends:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    )
  }
}

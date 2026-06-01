import { NextResponse } from 'next/server'
import {
  enqueueQuickAddJobs,
  listActiveQuickAddJobs,
} from '@/lib/database/creator-pipeline/process-quick-add-jobs'
import { invokeQuickAddProcessor } from '@/lib/creator-outreach/invoke-quick-add-processor'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireCreatorCrmApi(request)
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = getAdminSupabaseClient()
    const jobs = await listActiveQuickAddJobs(supabase)
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('GET /api/creator-pipeline/quick-add/jobs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireCreatorCrmApi(request)
  if (auth instanceof NextResponse) return auth

  let body: { url?: string; urls?: string[] }
  try {
    body = (await request.json()) as { url?: string; urls?: string[] }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const urls = [
    ...(body.urls ?? []),
    ...(body.url ? [body.url] : []),
  ].map((u) => u.trim()).filter(Boolean)

  if (urls.length === 0) {
    return NextResponse.json({ error: 'Provide url or urls' }, { status: 400 })
  }

  try {
    const supabase = getAdminSupabaseClient()
    const { jobs, skipped } = await enqueueQuickAddJobs(supabase, auth.userId, urls)

    void invokeQuickAddProcessor(supabase).catch((err) => {
      console.error('invokeQuickAddProcessor after enqueue:', err)
    })

    return NextResponse.json({ jobs, skipped })
  } catch (error) {
    console.error('POST /api/creator-pipeline/quick-add/jobs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enqueue' },
      { status: 500 }
    )
  }
}

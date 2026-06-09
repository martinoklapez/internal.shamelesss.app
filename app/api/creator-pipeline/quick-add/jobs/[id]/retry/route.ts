import { NextResponse } from 'next/server'
import { retryQuickAddJob } from '@/lib/database/creator-pipeline/process-quick-add-jobs'
import { invokeQuickAddEdgeWorker } from '@/lib/creator-outreach/invoke-quick-add-edge-worker'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCreatorCrmApi(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await context.params

  try {
    const supabase = getAdminSupabaseClient()
    const job = await retryQuickAddJob(supabase, id)
    void invokeQuickAddEdgeWorker(supabase).catch((err) => {
      console.error('invokeQuickAddEdgeWorker after retry:', err)
    })
    return NextResponse.json({ job })
  } catch (error) {
    console.error('POST quick-add retry:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Retry failed' },
      { status: 500 }
    )
  }
}

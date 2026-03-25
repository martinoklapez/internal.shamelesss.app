import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/api/admin-auth'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import type { ReengagementCampaignExecution } from '@/lib/reengagement-types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')
    const limit = Number(searchParams.get('limit') ?? '50')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    const admin = getAdminSupabaseClient()
    const { data, error } = await admin
      .from('reengagement_campaign_executions')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('executed_at', { ascending: false })
      .limit(Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ executions: (data ?? []) as ReengagementCampaignExecution[] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

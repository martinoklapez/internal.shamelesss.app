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
    const pageRaw = Number(searchParams.get('page') ?? '1')
    const pageSizeRaw = Number(searchParams.get('page_size') ?? searchParams.get('limit') ?? '20')
    /** Back-compat: `limit` without page = first page only */
    const legacyLimit = searchParams.get('limit') && !searchParams.get('page')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    const admin = getAdminSupabaseClient()

    if (legacyLimit) {
      const limit = Number.isFinite(pageSizeRaw) ? Math.max(1, Math.min(pageSizeRaw, 500)) : 20
      const { data, error } = await admin
        .from('reengagement_campaign_executions')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('executed_at', { ascending: false })
        .limit(limit)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ executions: (data ?? []) as ReengagementCampaignExecution[] })
    }

    const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1
    const pageSize = Number.isFinite(pageSizeRaw)
      ? Math.max(1, Math.min(Math.floor(pageSizeRaw), 100))
      : 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await admin
      .from('reengagement_campaign_executions')
      .select('*', { count: 'exact' })
      .eq('campaign_id', campaignId)
      .order('executed_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const total = count ?? 0
    return NextResponse.json({
      executions: (data ?? []) as ReengagementCampaignExecution[],
      total,
      page,
      page_size: pageSize,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

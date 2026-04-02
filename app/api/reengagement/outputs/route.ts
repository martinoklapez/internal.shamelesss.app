import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/api/admin-auth'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import type { ReengagementCampaignOutput, ReengagementOutputType } from '@/lib/reengagement-types'

export const dynamic = 'force-dynamic'

function defaultConfig(outputType: ReengagementOutputType): Record<string, unknown> {
  if (outputType === 'friend_request') {
    return {
      sender_selector: 'any_male',
      preferred_user_id: null,
      specific_user_id: null,
      fallback_sender_selector: null,
      message: null,
    }
  }
  if (outputType === 'push_notification') {
    return {
      title: 'Come back!',
      body: 'You have new activity waiting in Shamelesss.',
      superwall_trigger_id: 'special_offer',
    }
  }
  return { count: 1, viewer_selector: 'same_country', fallback_country_code: 'US' }
}

export async function GET(request: Request) {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })

    const admin = getAdminSupabaseClient()
    const { data, error } = await admin
      .from('reengagement_campaign_outputs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('order_index', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ outputs: (data ?? []) as ReengagementCampaignOutput[] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as Partial<ReengagementCampaignOutput>
    if (!body.campaign_id) return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    const outputType = (body.output_type ?? 'push_notification') as ReengagementOutputType

    const admin = getAdminSupabaseClient()
    const { count, error: countError } = await admin
      .from('reengagement_campaign_outputs')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', body.campaign_id)
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })

    const payload = {
      campaign_id: body.campaign_id,
      order_index: body.order_index ?? count ?? 0,
      delay_seconds: body.delay_seconds ?? 0,
      output_type: outputType,
      config: body.config ?? defaultConfig(outputType),
    }

    const { data, error } = await admin
      .from('reengagement_campaign_outputs')
      .insert(payload)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ output: data as ReengagementCampaignOutput })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as
      | (Partial<ReengagementCampaignOutput> & { id: string })
      | { reorder: Array<{ id: string; order_index: number }> }

    const admin = getAdminSupabaseClient()

    if ('reorder' in body) {
      for (const row of body.reorder) {
        const { error } = await admin
          .from('reengagement_campaign_outputs')
          .update({ order_index: row.order_index })
          .eq('id', row.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    const { id, ...rest } = body
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { data, error } = await admin
      .from('reengagement_campaign_outputs')
      .update(rest)
      .eq('id', id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ output: data as ReengagementCampaignOutput })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const admin = getAdminSupabaseClient()
    const { error } = await admin.from('reengagement_campaign_outputs').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

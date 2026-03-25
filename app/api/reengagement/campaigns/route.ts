import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/api/admin-auth'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import type { ReengagementCampaign } from '@/lib/reengagement-types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  try {
    const admin = getAdminSupabaseClient()
    const { data, error } = await admin
      .from('reengagement_campaigns')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ campaigns: (data ?? []) as ReengagementCampaign[] })
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
    const body = (await request.json()) as Partial<ReengagementCampaign>
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const payload = {
      name: body.name.trim(),
      is_active: body.is_active ?? true,
      run_once_per_user: body.run_once_per_user ?? false,
      skip_if_subscribed_entitlements: body.skip_if_subscribed_entitlements ?? [],
      skip_users_without_push_tokens: body.skip_users_without_push_tokens ?? true,
      intensity_type: body.intensity_type ?? 'once_per_user',
      intensity_x: body.intensity_x ?? null,
      intensity_y_days: body.intensity_y_days ?? null,
      trigger_type: body.trigger_type ?? 'app_close',
    }

    const admin = getAdminSupabaseClient()
    const { data, error } = await admin
      .from('reengagement_campaigns')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ campaign: data as ReengagementCampaign })
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
    const body = (await request.json()) as Partial<ReengagementCampaign> & { id?: string }
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const payload = {
      name: body.name?.trim(),
      is_active: body.is_active,
      run_once_per_user: body.run_once_per_user,
      skip_if_subscribed_entitlements: body.skip_if_subscribed_entitlements,
      skip_users_without_push_tokens: body.skip_users_without_push_tokens,
      intensity_type: body.intensity_type,
      intensity_x: body.intensity_x,
      intensity_y_days: body.intensity_y_days,
      trigger_type: body.trigger_type,
    }

    const admin = getAdminSupabaseClient()
    const { data, error } = await admin
      .from('reengagement_campaigns')
      .update(payload)
      .eq('id', body.id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ campaign: data as ReengagementCampaign })
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
    const { error } = await admin.from('reengagement_campaigns').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

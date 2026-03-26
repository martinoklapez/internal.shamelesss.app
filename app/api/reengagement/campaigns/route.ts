import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/api/admin-auth'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  normalizeReengagementCampaign,
  type ReengagementCampaign,
  type ReengagementScheduleKind,
} from '@/lib/reengagement-types'

export const dynamic = 'force-dynamic'

const EMPTY_TS = (v: unknown): string | null =>
  v === null || v === undefined ? null : typeof v === 'string' && v.trim() === '' ? null : String(v).trim()

const SCHEDULE_KIND = (v: unknown): ReengagementScheduleKind | null => {
  if (v === null || v === undefined || v === '') return null
  if (v === 'one_off' || v === 'recurring') return v
  return null
}

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

    const campaigns = (data ?? []).map((c) =>
      normalizeReengagementCampaign(c as ReengagementCampaign)
    )
    return NextResponse.json({ campaigns })
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
      schedule_paused: body.schedule_paused ?? false,
      schedule_timezone: typeof body.schedule_timezone === 'string' && body.schedule_timezone.trim()
        ? body.schedule_timezone.trim()
        : 'UTC',
      schedule_kind: SCHEDULE_KIND(body.schedule_kind),
      scheduled_at: EMPTY_TS(body.scheduled_at),
      schedule_cron: EMPTY_TS(body.schedule_cron),
      next_run_at: EMPTY_TS(body.next_run_at),
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

    return NextResponse.json({
      campaign: normalizeReengagementCampaign(data as ReengagementCampaign),
    })
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

    /** Never let the admin client overwrite orchestrator-owned fields. */
    const payload: Record<string, unknown> = {}
    if (body.name !== undefined) payload.name = body.name.trim()
    if (body.is_active !== undefined) payload.is_active = body.is_active
    if (body.run_once_per_user !== undefined) payload.run_once_per_user = body.run_once_per_user
    if (body.skip_if_subscribed_entitlements !== undefined) {
      payload.skip_if_subscribed_entitlements = body.skip_if_subscribed_entitlements
    }
    if (body.skip_users_without_push_tokens !== undefined) {
      payload.skip_users_without_push_tokens = body.skip_users_without_push_tokens
    }
    if (body.intensity_type !== undefined) payload.intensity_type = body.intensity_type
    if (body.intensity_x !== undefined) payload.intensity_x = body.intensity_x
    if (body.intensity_y_days !== undefined) payload.intensity_y_days = body.intensity_y_days
    if (body.trigger_type !== undefined) payload.trigger_type = body.trigger_type
    if (body.schedule_paused !== undefined) payload.schedule_paused = body.schedule_paused
    if (body.schedule_timezone !== undefined) {
      const z = typeof body.schedule_timezone === 'string' ? body.schedule_timezone.trim() : ''
      payload.schedule_timezone = z || 'UTC'
    }
    if (body.schedule_kind !== undefined) payload.schedule_kind = SCHEDULE_KIND(body.schedule_kind)
    if (body.scheduled_at !== undefined) payload.scheduled_at = EMPTY_TS(body.scheduled_at)
    if (body.schedule_cron !== undefined) payload.schedule_cron = EMPTY_TS(body.schedule_cron)
    if (body.next_run_at !== undefined) payload.next_run_at = EMPTY_TS(body.next_run_at)

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

    return NextResponse.json({
      campaign: normalizeReengagementCampaign(data as ReengagementCampaign),
    })
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

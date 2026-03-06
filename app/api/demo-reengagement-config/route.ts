import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'
import {
  getDemoReengagementConfig,
  updateDemoReengagementConfig,
  createDefaultCampaign,
  type Campaign,
  type FlowSlot,
  type GenderMode,
  type Trigger,
} from '@/lib/database/demo-reengagement-config'

const GENDER_MODES: GenderMode[] = ['any', 'all_opposite', 'all_same', 'random', 'percentage']
const TRIGGERS: Trigger[] = ['app_close', 'conversion_complete', 'purchase_pro']

function parseGenderMode(value: unknown): GenderMode {
  if (typeof value === 'string' && GENDER_MODES.includes(value as GenderMode)) {
    return value as GenderMode
  }
  return 'all_opposite'
}

function parseTrigger(value: unknown): Trigger {
  if (typeof value === 'string' && TRIGGERS.includes(value as Trigger)) {
    return value as Trigger
  }
  return 'app_close'
}

function clampPercentage(n: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0.5
  return Math.max(0, Math.min(1, n))
}

function parseDelaySecondsBody(r: Record<string, unknown>): number {
  if (typeof r.delay_seconds === 'number' && r.delay_seconds >= 0) return Math.floor(r.delay_seconds)
  if (typeof r.delay_minutes === 'number' && r.delay_minutes >= 0) return r.delay_minutes * 60
  return 0
}

const FALLBACK_GENDERS = ['opposite', 'same', 'male', 'female', 'any'] as const
type FallbackGender = (typeof FALLBACK_GENDERS)[number]

function parseFlowSlotBody(raw: unknown): {
  demo_user_id: string
  demo_user_id_male?: string
  demo_user_id_female?: string
  message: string | null
  fallback?: { gender: FallbackGender }
  delay_after_seconds?: number
} | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const demo_user_id = typeof s.demo_user_id === 'string' ? s.demo_user_id : ''
  const demo_user_id_male = typeof s.demo_user_id_male === 'string' && s.demo_user_id_male.trim() ? s.demo_user_id_male : undefined
  const demo_user_id_female = typeof s.demo_user_id_female === 'string' && s.demo_user_id_female.trim() ? s.demo_user_id_female : undefined
  const message = s.message === null || typeof s.message === 'string' ? s.message : null
  let fallback: { gender: FallbackGender } | undefined
  if (s.fallback && typeof s.fallback === 'object' && s.fallback !== null && 'gender' in s.fallback) {
    const g = (s.fallback as Record<string, unknown>).gender
    if (typeof g === 'string' && FALLBACK_GENDERS.includes(g as FallbackGender)) fallback = { gender: g as FallbackGender }
  }
  const delay_after_seconds =
    typeof s.delay_after_seconds === 'number' && s.delay_after_seconds >= 0
      ? Math.floor(s.delay_after_seconds)
      : undefined
  const resolvedId = demo_user_id.trim() || demo_user_id_male || demo_user_id_female || ''
  return {
    demo_user_id: resolvedId,
    ...(demo_user_id_male && { demo_user_id_male }),
    ...(demo_user_id_female && { demo_user_id_female }),
    message,
    fallback,
    ...(typeof delay_after_seconds === 'number' && { delay_after_seconds }),
  }
}

function parseFlowSlotsBody(value: unknown): FlowSlot[] {
  if (!Array.isArray(value)) return []
  return value
    .map(parseFlowSlotBody)
    .filter((s): s is NonNullable<typeof s> => s !== null) as FlowSlot[]
}

function migrateFlowUserIdsBody(value: unknown): { demo_user_id: string; message: string | null }[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
    .map((demo_user_id) => ({
      demo_user_id,
      message: null as string | null,
    }))
}

function parseCampaignFromBody(raw: unknown): Campaign | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const targetRaw = r.target_selection
  let target_selection: Campaign['target_selection']
  if (targetRaw && typeof targetRaw === 'object' && 'mode' in targetRaw) {
    const t = targetRaw as Record<string, unknown>
    if (t.mode === 'direct') {
      const slots = Array.isArray(t.flow_slots) && t.flow_slots.length > 0
        ? parseFlowSlotsBody(t.flow_slots)
        : migrateFlowUserIdsBody(t.flow_user_ids)
      target_selection = { mode: 'direct', flow_slots: slots }
    } else {
      target_selection = {
        mode: 'demographics',
        gender_mode: parseGenderMode(t.gender_mode),
        gender_opposite_percentage: clampPercentage(
          typeof t.gender_opposite_percentage === 'number' ? t.gender_opposite_percentage : 0.5
        ),
        country_match: typeof t.country_match === 'boolean' ? t.country_match : false,
      }
    }
  } else {
    target_selection = { mode: 'direct', flow_slots: [] }
  }
  return {
    id: typeof r.id === 'string' ? r.id : createDefaultCampaign().id,
    name: typeof r.name === 'string' ? r.name : 'Unnamed',
    enabled: typeof r.enabled === 'boolean' ? r.enabled : false,
    trigger: parseTrigger(r.trigger),
    skip_if_subscribed: typeof r.skip_if_subscribed === 'boolean' ? r.skip_if_subscribed : true,
    run_once_per_user: typeof r.run_once_per_user === 'boolean' ? r.run_once_per_user : true,
    delay_seconds: parseDelaySecondsBody(r),
    delay_between_slots_seconds:
      typeof r.delay_between_slots_seconds === 'number' && r.delay_between_slots_seconds >= 0
        ? Math.floor(r.delay_between_slots_seconds)
        : 0,
    target_selection,
    rate_limit_hours: typeof r.rate_limit_hours === 'number' ? r.rate_limit_hours : 24,
    max_requests_per_user_per_day:
      typeof r.max_requests_per_user_per_day === 'number' ? r.max_requests_per_user_per_day : 1,
    requests_per_trigger:
      typeof r.requests_per_trigger === 'number' && r.requests_per_trigger >= 1
        ? r.requests_per_trigger
        : 1,
    min_days_since_signup:
      typeof r.min_days_since_signup === 'number' ? r.min_days_since_signup : 0,
    exclude_promoter: typeof r.exclude_promoter === 'boolean' ? r.exclude_promoter : true,
    include_message: typeof r.include_message === 'boolean' ? r.include_message : false,
    message_template:
      r.message_template === null || typeof r.message_template === 'string'
        ? r.message_template
        : null,
  }
}

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = await getDemoReengagementConfig()
    return NextResponse.json(config, { status: 200 })
  } catch (error) {
    console.error('Error in demo-reengagement-config GET:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = await getUserRole(user.id)
    if (userRole !== 'admin' && userRole !== 'dev' && userRole !== 'developer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const rawCampaigns = Array.isArray(body.campaigns) ? body.campaigns : []
    const campaigns = rawCampaigns
      .map(parseCampaignFromBody)
      .filter((c: Campaign | null): c is Campaign => c !== null)

    const config = { campaigns }
    const updated = await updateDemoReengagementConfig(config)
    return NextResponse.json(updated, { status: 200 })
  } catch (error) {
    console.error('Error in demo-reengagement-config PUT:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

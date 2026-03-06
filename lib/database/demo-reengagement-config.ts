import { createClient } from '@/lib/supabase/server'
import {
  type Campaign,
  type CampaignsConfig,
  type GenderMode,
  type TargetSelection,
  type TargetSelectionDirect,
  type Trigger,
  createDefaultCampaign,
} from '@/lib/demo-reengagement-types'

export type {
  Campaign,
  CampaignsConfig,
  FallbackGender,
  FlowSlot,
  GenderMode,
  TargetSelection,
  TargetSelectionDirect,
  TargetSelectionDemographics,
  Trigger,
} from '@/lib/demo-reengagement-types'
export { createDefaultCampaign } from '@/lib/demo-reengagement-types'

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

const FALLBACK_GENDERS = ['opposite', 'same', 'male', 'female', 'any'] as const

function parseFallbackGender(value: unknown): 'opposite' | 'same' | 'male' | 'female' | 'any' {
  if (typeof value === 'string' && FALLBACK_GENDERS.includes(value as any)) return value as any
  return 'any'
}

function parseFlowSlot(raw: unknown): TargetSelectionDirect['flow_slots'][0] | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const demo_user_id = typeof r.demo_user_id === 'string' ? r.demo_user_id : ''
  const demo_user_id_male = typeof r.demo_user_id_male === 'string' && r.demo_user_id_male.trim() ? r.demo_user_id_male : undefined
  const demo_user_id_female = typeof r.demo_user_id_female === 'string' && r.demo_user_id_female.trim() ? r.demo_user_id_female : undefined
  const message = r.message === null || typeof r.message === 'string' ? r.message : null
  let fallback: { gender: 'opposite' | 'same' | 'male' | 'female' | 'any' } | undefined
  if (r.fallback && typeof r.fallback === 'object' && r.fallback !== null && 'gender' in r.fallback) {
    const g = parseFallbackGender((r.fallback as Record<string, unknown>).gender)
    if (g !== 'any') fallback = { gender: g }
  }
  const delay_after_seconds =
    typeof r.delay_after_seconds === 'number' && r.delay_after_seconds >= 0
      ? Math.floor(r.delay_after_seconds)
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

function parseFlowSlots(value: unknown): TargetSelectionDirect['flow_slots'] {
  if (!Array.isArray(value)) return []
  return value.map(parseFlowSlot).filter((s): s is NonNullable<typeof s> => s !== null)
}

/** Legacy: flow_user_ids → flow_slots (single demo_user_id per slot) */
function migrateFlowUserIds(value: unknown): TargetSelectionDirect['flow_slots'] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
    .map((demo_user_id) => ({
      demo_user_id,
      message: null as string | null,
    }))
}

function clampPercentage(n: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0.5
  return Math.max(0, Math.min(1, n))
}

const DEFAULT_DIRECT: TargetSelectionDirect = { mode: 'direct', flow_slots: [] }

/** Prefer delay_seconds; convert legacy delay_minutes to seconds when loading */
function parseDelaySeconds(r: Record<string, unknown>): number {
  if (typeof r.delay_seconds === 'number' && r.delay_seconds >= 0) return Math.floor(r.delay_seconds)
  if (typeof r.delay_minutes === 'number' && r.delay_minutes >= 0) return r.delay_minutes * 60
  return 0
}

function parseTargetSelection(raw: unknown): TargetSelection {
  if (raw && typeof raw === 'object' && 'mode' in raw) {
    const r = raw as Record<string, unknown>
    if (r.mode === 'direct') {
      const slots = Array.isArray(r.flow_slots) && r.flow_slots.length > 0
        ? parseFlowSlots(r.flow_slots)
        : migrateFlowUserIds(r.flow_user_ids)
      return { mode: 'direct', flow_slots: slots }
    }
    if (r.mode === 'demographics') {
      return {
        mode: 'demographics',
        gender_mode: parseGenderMode(r.gender_mode),
        gender_opposite_percentage: clampPercentage(
          typeof r.gender_opposite_percentage === 'number' ? r.gender_opposite_percentage : 0.5
        ),
        country_match: typeof r.country_match === 'boolean' ? r.country_match : false,
      }
    }
  }
  return { ...DEFAULT_DIRECT }
}

function parseCampaign(raw: unknown): Campaign | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id : `campaign-${Date.now()}`
  return {
    id,
    name: typeof r.name === 'string' ? r.name : 'Unnamed',
    enabled: typeof r.enabled === 'boolean' ? r.enabled : false,
    trigger: parseTrigger(r.trigger),
    skip_if_subscribed: typeof r.skip_if_subscribed === 'boolean' ? r.skip_if_subscribed : true,
    run_once_per_user: typeof r.run_once_per_user === 'boolean' ? r.run_once_per_user : true,
    delay_seconds: parseDelaySeconds(r),
    delay_between_slots_seconds:
      typeof r.delay_between_slots_seconds === 'number' && r.delay_between_slots_seconds >= 0
        ? Math.floor(r.delay_between_slots_seconds)
        : 0,
    target_selection: parseTargetSelection(r.target_selection),
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

/** Migrate legacy flat config to a single campaign */
function legacyToCampaign(raw: Record<string, unknown>): Campaign {
  let gender_mode = parseGenderMode(raw.gender_mode)
  if (raw.gender_mode == null && typeof raw.match_opposite_gender === 'boolean') {
    gender_mode = raw.match_opposite_gender ? 'all_opposite' : 'any'
  }
  const use_flow = typeof raw.use_flow === 'boolean' ? raw.use_flow : false
  return {
    id: 'legacy',
    name: 'Legacy (migrated)',
    enabled: true,
    trigger: 'app_close',
    skip_if_subscribed: true,
    run_once_per_user: true,
    delay_seconds: parseDelaySeconds(raw),
    delay_between_slots_seconds: 0,
    target_selection: use_flow
      ? { mode: 'direct', flow_slots: migrateFlowUserIds(raw.flow_user_ids) }
      : {
          mode: 'demographics',
          gender_mode,
          gender_opposite_percentage: clampPercentage(
            typeof raw.gender_opposite_percentage === 'number' ? raw.gender_opposite_percentage : 0.5
          ),
          country_match: false,
        },
    rate_limit_hours: typeof raw.rate_limit_hours === 'number' ? raw.rate_limit_hours : 24,
    max_requests_per_user_per_day:
      typeof raw.max_requests_per_user_per_day === 'number' ? raw.max_requests_per_user_per_day : 1,
    requests_per_trigger:
      typeof raw.requests_per_trigger === 'number' && raw.requests_per_trigger >= 1
        ? raw.requests_per_trigger
        : 1,
    min_days_since_signup:
      typeof raw.min_days_since_signup === 'number' ? raw.min_days_since_signup : 0,
    exclude_promoter: typeof raw.exclude_promoter === 'boolean' ? raw.exclude_promoter : true,
    include_message: typeof raw.include_message === 'boolean' ? raw.include_message : false,
    message_template:
      raw.message_template === null || typeof raw.message_template === 'string'
        ? raw.message_template
        : null,
  }
}

export async function getDemoReengagementConfig(): Promise<CampaignsConfig> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('demo_reengagement_config')
    .select('config')
    .eq('id', 'default')
    .single()

  if (error || !data?.config) {
    return { campaigns: [createDefaultCampaign('default')] }
  }

  const raw = data.config as Record<string, unknown>

  if (Array.isArray(raw.campaigns)) {
    const campaigns = raw.campaigns.map(parseCampaign).filter((c): c is Campaign => c !== null)
    if (campaigns.length > 0) return { campaigns }
  }

  return { campaigns: [legacyToCampaign(raw)] }
}

function serializeTargetSelection(t: TargetSelection): Record<string, unknown> {
  if (t.mode === 'direct') {
    return {
      mode: 'direct',
      flow_slots: t.flow_slots.map((s) => ({
        demo_user_id: s.demo_user_id || s.demo_user_id_male || s.demo_user_id_female || '',
        ...(s.demo_user_id_male && { demo_user_id_male: s.demo_user_id_male }),
        ...(s.demo_user_id_female && { demo_user_id_female: s.demo_user_id_female }),
        message: s.message,
        ...(s.fallback && { fallback: s.fallback }),
        ...(s.delay_after_seconds !== undefined && s.delay_after_seconds >= 0 && { delay_after_seconds: s.delay_after_seconds }),
      })),
    }
  }
  return {
    mode: 'demographics',
    gender_mode: t.gender_mode,
    gender_opposite_percentage: t.gender_opposite_percentage,
    country_match: t.country_match,
  }
}

export async function updateDemoReengagementConfig(
  config: CampaignsConfig
): Promise<CampaignsConfig> {
  const supabase = await createClient()
  const serialized = {
    campaigns: config.campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      enabled: c.enabled,
      trigger: c.trigger,
      skip_if_subscribed: c.skip_if_subscribed,
      run_once_per_user: c.run_once_per_user,
      delay_seconds: c.delay_seconds,
      delay_between_slots_seconds: c.delay_between_slots_seconds,
      target_selection: serializeTargetSelection(c.target_selection),
      rate_limit_hours: c.rate_limit_hours,
      max_requests_per_user_per_day: c.max_requests_per_user_per_day,
      requests_per_trigger: c.requests_per_trigger,
      min_days_since_signup: c.min_days_since_signup,
      exclude_promoter: c.exclude_promoter,
      include_message: c.include_message,
      message_template: c.message_template,
    })),
  }

  const { data, error } = await supabase
    .from('demo_reengagement_config')
    .update({ config: serialized, updated_at: new Date().toISOString() })
    .eq('id', 'default')
    .select('config')
    .single()

  if (error) {
    throw new Error(`Failed to update demo re-engagement config: ${error.message}`)
  }

  const updated = data?.config as { campaigns?: unknown[] }
  if (!updated?.campaigns) return config
  const campaigns = updated.campaigns.map(parseCampaign).filter((c): c is Campaign => c !== null)
  return { campaigns }
}

export interface DemoUser {
  user_id: string
  name: string | null
  username: string | null
  profile_picture_url: string | null
  gender: string | null
}

export async function getDemoUsers(): Promise<DemoUser[]> {
  const supabase = await createClient()
  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'demo')

  if (roleError || !roleRows?.length) {
    return []
  }

  const userIds = roleRows.map((r) => r.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, username, profile_picture_url, gender')
    .in('user_id', userIds)

  const profileByUserId = new Map(
    (profiles ?? []).map((p) => [
      p.user_id,
      {
        name: p.name ?? null,
        username: p.username ?? null,
        profile_picture_url: p.profile_picture_url ?? null,
        gender: p.gender ?? null,
      },
    ])
  )

  return userIds.map((user_id) => {
    const p = profileByUserId.get(user_id)
    return {
      user_id,
      name: p?.name ?? null,
      username: p?.username ?? null,
      profile_picture_url: p?.profile_picture_url ?? null,
      gender: p?.gender ?? null,
    }
  })
}

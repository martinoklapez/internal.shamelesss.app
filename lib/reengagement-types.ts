export type ReengagementIntensityType = 'once_per_user' | 'x_per_y_days'
export type ReengagementTriggerType = 'app_close' | 'scheduled' | 'subscription_cancelled'

export const REENGAGEMENT_TRIGGER_TYPES: readonly ReengagementTriggerType[] = [
  'app_close',
  'scheduled',
  'subscription_cancelled',
] as const

export function isReengagementTriggerType(v: unknown): v is ReengagementTriggerType {
  return typeof v === 'string' && (REENGAGEMENT_TRIGGER_TYPES as readonly string[]).includes(v)
}
export type ReengagementOutputType = 'friend_request' | 'push_notification' | 'profile_views'
export type ReengagementScheduleKind = 'one_off' | 'recurring'

/**
 * friend_request.config.sender_selector — runtime: run-reengagement Edge Function.
 * primarySenderId = first non-empty string among preferred_user_id, specific_user_id.
 */
export type ReengagementFriendSenderSelector =
  | 'preferred_user'
  | 'specific_user'
  | 'any_male'
  | 'any_female'
  | 'opposite_gender'
  | 'same_gender'

/** Pool step only (fallback_sender_selector). Same semantics as top-level pool modes. */
export type ReengagementFriendPoolSelector =
  | 'any_male'
  | 'any_female'
  | 'opposite_gender'
  | 'same_gender'

/** Targeting on profiles.*; all set dimensions are AND’d. Empty object = no restriction. */
export interface ReengagementAudienceFilter {
  genders?: string[]
  country_codes?: string[]
  age_min?: number
  age_max?: number
}

export const REENGAGEMENT_GENDER_OPTIONS = ['male', 'female', 'other'] as const

export interface ReengagementCampaign {
  id: string
  name: string
  is_active: boolean
  run_once_per_user: boolean
  skip_if_subscribed_entitlements: string[]
  skip_users_without_push_tokens: boolean
  intensity_type: ReengagementIntensityType
  intensity_x: number | null
  intensity_y_days: number | null
  trigger_type: ReengagementTriggerType
  created_at: string
  updated_at: string
  /** Scheduled campaigns: orchestrator ignores when true; does not clear next_run_at */
  schedule_paused: boolean
  /** IANA / label for displaying scheduled_at; cron is evaluated in UTC */
  schedule_timezone: string
  schedule_kind: ReengagementScheduleKind | null
  /** UTC; semantic “first run” for one_off */
  scheduled_at: string | null
  /** 5-field cron, UTC, when schedule_kind = recurring */
  schedule_cron: string | null
  /** Driver for scheduling: due when <= now() */
  next_run_at: string | null
  /** Set when a full profile sweep finishes (server-managed; do not PATCH from admin) */
  last_run_at: string | null
  /** Keyset cursor during split sweep (server-managed) */
  schedule_resume_after_user_id: string | null
  /** True while a multi-page sweep is incomplete (server-managed) */
  schedule_run_in_progress: boolean
  /** JSON targeting; server normalizes compares (gender lower, country upper). */
  audience_filter: ReengagementAudienceFilter
}

export interface ReengagementCampaignOutput {
  id: string
  campaign_id: string
  order_index: number
  delay_seconds: number
  output_type: ReengagementOutputType
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ReengagementCampaignExecution {
  id: string
  campaign_id: string
  user_id: string
  executed_at: string
  created_at: string
}

export const REENGAGEMENT_ENTITLEMENT_OPTIONS = [
  'plus',
  'pro',
  'has_active_subscription',
  'has_full_access',
] as const

export const REENGAGEMENT_FRIEND_SENDER_OPTIONS: ReengagementFriendSenderSelector[] = [
  'preferred_user',
  'specific_user',
  'any_male',
  'any_female',
  'opposite_gender',
  'same_gender',
]

export const REENGAGEMENT_FRIEND_POOL_SELECTOR_OPTIONS: ReengagementFriendPoolSelector[] = [
  'any_male',
  'any_female',
  'opposite_gender',
  'same_gender',
]

export function isReengagementFriendSenderSelector(v: unknown): v is ReengagementFriendSenderSelector {
  return (
    typeof v === 'string' &&
    (REENGAGEMENT_FRIEND_SENDER_OPTIONS as readonly string[]).includes(v)
  )
}

export function isReengagementFriendPoolSelector(v: unknown): v is ReengagementFriendPoolSelector {
  return (
    typeof v === 'string' &&
    (REENGAGEMENT_FRIEND_POOL_SELECTOR_OPTIONS as readonly string[]).includes(v)
  )
}

/** Sanitize audience_filter from DB or API body: only valid keys, normalized values, `{}` when no rules. */
export function normalizeAudienceFilter(raw: unknown): ReengagementAudienceFilter {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }
  const o = raw as Record<string, unknown>
  const out: ReengagementAudienceFilter = {}

  if (Array.isArray(o.genders)) {
    const genders = [
      ...new Set(
        o.genders
          .map((x) => String(x ?? '').trim().toLowerCase())
          .filter((x) => x.length > 0)
      ),
    ].sort()
    if (genders.length > 0) out.genders = genders
  }

  if (Array.isArray(o.country_codes)) {
    const country_codes = [
      ...new Set(
        o.country_codes
          .map((x) => String(x ?? '').trim().toUpperCase())
          .filter((x) => /^[A-Z]{2}$/.test(x))
      ),
    ].sort()
    if (country_codes.length > 0) out.country_codes = country_codes
  }

  const parseAge = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === '') return undefined
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n)) return undefined
    const i = Math.floor(n)
    if (i < 0 || i > 150) return undefined
    return i
  }

  const age_min = parseAge(o.age_min)
  const age_max = parseAge(o.age_max)
  if (age_min !== undefined) out.age_min = age_min
  if (age_max !== undefined) out.age_max = age_max
  if (out.age_min !== undefined && out.age_max !== undefined && out.age_min > out.age_max) {
    const t = out.age_min
    out.age_min = out.age_max
    out.age_max = t
  }

  return out
}

/** Coerce nullable / missing schedule columns after `select('*')` (e.g. older rows or partial JSON). */
export function normalizeReengagementCampaign(row: ReengagementCampaign): ReengagementCampaign {
  return {
    ...row,
    skip_if_subscribed_entitlements: row.skip_if_subscribed_entitlements ?? [],
    schedule_paused: row.schedule_paused ?? false,
    schedule_timezone: row.schedule_timezone?.trim() ? row.schedule_timezone : 'UTC',
    schedule_kind: row.schedule_kind ?? null,
    scheduled_at: row.scheduled_at ?? null,
    schedule_cron: row.schedule_cron ?? null,
    next_run_at: row.next_run_at ?? null,
    last_run_at: row.last_run_at ?? null,
    schedule_resume_after_user_id: row.schedule_resume_after_user_id ?? null,
    schedule_run_in_progress: row.schedule_run_in_progress ?? false,
    audience_filter: normalizeAudienceFilter((row as { audience_filter?: unknown }).audience_filter),
  }
}

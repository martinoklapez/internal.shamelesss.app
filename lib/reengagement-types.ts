export type ReengagementIntensityType = 'once_per_user' | 'x_per_y_days'
export type ReengagementTriggerType = 'app_close' | 'scheduled'
export type ReengagementOutputType = 'friend_request' | 'push_notification' | 'profile_views'
export type ReengagementScheduleKind = 'one_off' | 'recurring'

/** friend_request.config.sender_selector */
export type ReengagementFriendSenderSelector =
  | 'any_male'
  | 'any_female'
  | 'opposite_gender'
  | 'specific_user'

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
  'any_male',
  'any_female',
  'opposite_gender',
  'specific_user',
]

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
  }
}

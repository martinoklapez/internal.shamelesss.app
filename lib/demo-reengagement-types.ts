/**
 * Shared types and helpers for demo re-engagement campaigns.
 * This file has no server-only imports so it can be used from client components.
 */

export type GenderMode = 'any' | 'all_opposite' | 'all_same' | 'random' | 'percentage'

export type Trigger = 'app_close' | 'conversion_complete' | 'purchase_pro'

/** Fallback gender when primary demo user is unavailable (random user matching this) */
export type FallbackGender = 'opposite' | 'same' | 'male' | 'female' | 'any'

/** One slot in direct mode: male/female accounts, optional message, fallback, and per-slot delay */
export interface FlowSlot {
  /** Legacy/fallback: used when no gender-specific, or when target has no gender */
  demo_user_id: string
  /** Account when target user is male */
  demo_user_id_male?: string
  /** Account when target user is female */
  demo_user_id_female?: string
  message: string | null
  fallback?: { gender: FallbackGender }
  /** Delay in seconds before the next slot runs. Overrides campaign delay_between_slots_seconds for this slot. */
  delay_after_seconds?: number
}

/** Target selection: ordered list of slots (direct mode) */
export interface TargetSelectionDirect {
  mode: 'direct'
  flow_slots: FlowSlot[]
}

/** Target selection: pick by demographics (gender, optional country match) */
export interface TargetSelectionDemographics {
  mode: 'demographics'
  gender_mode: GenderMode
  gender_opposite_percentage: number
  country_match: boolean
}

export type TargetSelection = TargetSelectionDirect | TargetSelectionDemographics

export interface Campaign {
  id: string
  name: string
  enabled: boolean
  trigger: Trigger
  skip_if_subscribed: boolean
  /** If true (default), campaign runs at most once per user; tracked in demo_reengagement_completed */
  run_once_per_user: boolean
  /** 0 = immediate; >0 = schedule in seconds (processed by cron). e.g. 30, 120 for 2 min */
  delay_seconds: number
  /** Default delay in seconds between slots. Used when a slot has no delay_after_seconds. Direct mode only. */
  delay_between_slots_seconds: number
  target_selection: TargetSelection
  rate_limit_hours: number
  max_requests_per_user_per_day: number
  requests_per_trigger: number
  min_days_since_signup: number
  exclude_promoter: boolean
  include_message: boolean
  message_template: string | null
}

export interface CampaignsConfig {
  campaigns: Campaign[]
}

const DEFAULT_DIRECT: TargetSelectionDirect = { mode: 'direct', flow_slots: [] }

export function createDefaultCampaign(id?: string): Campaign {
  return {
    id: id ?? `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: 'New campaign',
    enabled: false,
    trigger: 'app_close',
    skip_if_subscribed: true,
    run_once_per_user: true,
    delay_seconds: 0,
    delay_between_slots_seconds: 0,
    target_selection: { ...DEFAULT_DIRECT },
    rate_limit_hours: 24,
    max_requests_per_user_per_day: 1,
    requests_per_trigger: 1,
    min_days_since_signup: 0,
    exclude_promoter: true,
    include_message: false,
    message_template: null,
  }
}

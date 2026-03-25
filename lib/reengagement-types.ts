export type ReengagementIntensityType = 'once_per_user' | 'x_per_y_days'
export type ReengagementTriggerType = 'app_close' | 'scheduled'
export type ReengagementOutputType = 'friend_request' | 'push_notification' | 'profile_views'

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

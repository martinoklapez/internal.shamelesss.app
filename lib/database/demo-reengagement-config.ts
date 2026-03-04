import { createClient } from '@/lib/supabase/server'

export interface DemoReengagementConfig {
  rate_limit_hours: number
  max_requests_per_user_per_day: number
  include_message: boolean
  message_template: string | null
  min_days_since_signup: number
  exclude_promoter: boolean
  match_opposite_gender: boolean
}

const DEFAULT_CONFIG: DemoReengagementConfig = {
  rate_limit_hours: 24,
  max_requests_per_user_per_day: 1,
  include_message: false,
  message_template: null,
  min_days_since_signup: 0,
  exclude_promoter: true,
  match_opposite_gender: false,
}

export async function getDemoReengagementConfig(): Promise<DemoReengagementConfig> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('demo_reengagement_config')
    .select('config')
    .eq('id', 'default')
    .single()

  if (error || !data?.config) {
    return { ...DEFAULT_CONFIG }
  }

  const raw = data.config as Record<string, unknown>
  return {
    rate_limit_hours: typeof raw.rate_limit_hours === 'number' ? raw.rate_limit_hours : DEFAULT_CONFIG.rate_limit_hours,
    max_requests_per_user_per_day:
      typeof raw.max_requests_per_user_per_day === 'number'
        ? raw.max_requests_per_user_per_day
        : DEFAULT_CONFIG.max_requests_per_user_per_day,
    include_message: typeof raw.include_message === 'boolean' ? raw.include_message : DEFAULT_CONFIG.include_message,
    message_template:
      raw.message_template === null || typeof raw.message_template === 'string'
        ? raw.message_template
        : DEFAULT_CONFIG.message_template,
    min_days_since_signup:
      typeof raw.min_days_since_signup === 'number' ? raw.min_days_since_signup : DEFAULT_CONFIG.min_days_since_signup,
    exclude_promoter: typeof raw.exclude_promoter === 'boolean' ? raw.exclude_promoter : DEFAULT_CONFIG.exclude_promoter,
    match_opposite_gender:
      typeof raw.match_opposite_gender === 'boolean' ? raw.match_opposite_gender : DEFAULT_CONFIG.match_opposite_gender,
  }
}

export async function updateDemoReengagementConfig(
  config: DemoReengagementConfig
): Promise<DemoReengagementConfig> {
  const supabase = await createClient()
  const payload = {
    config: {
      rate_limit_hours: config.rate_limit_hours,
      max_requests_per_user_per_day: config.max_requests_per_user_per_day,
      include_message: config.include_message,
      message_template: config.message_template,
      min_days_since_signup: config.min_days_since_signup,
      exclude_promoter: config.exclude_promoter,
      match_opposite_gender: config.match_opposite_gender,
    },
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('demo_reengagement_config')
    .update(payload)
    .eq('id', 'default')
    .select('config')
    .single()

  if (error) {
    throw new Error(`Failed to update demo re-engagement config: ${error.message}`)
  }

  return (data?.config as DemoReengagementConfig) ?? config
}

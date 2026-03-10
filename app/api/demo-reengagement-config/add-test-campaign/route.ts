import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'
import {
  getDemoReengagementConfig,
  updateDemoReengagementConfig,
  getDemoUsers,
  generateCampaignId,
  type Campaign,
  type CampaignsConfig,
} from '@/lib/database/demo-reengagement-config'

/** POST: append a time_absolute test campaign that fires in 5 minutes (UTC). Admin/developer only. */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = await getUserRole(user.id)
  if (role !== 'admin' && role !== 'dev' && role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const in5 = new Date(Date.now() + 5 * 60 * 1000)
  const day_of_week = in5.getUTCDay()
  const hour = in5.getUTCHours()
  const minute = in5.getUTCMinutes()

  let config: CampaignsConfig
  try {
    config = await getDemoReengagementConfig()
  } catch (e) {
    console.error('add-test-campaign getConfig:', e)
    return NextResponse.json(
      { error: 'Failed to load config' },
      { status: 500 }
    )
  }

  const demoUsers = await getDemoUsers()
  const firstDemoId =
    demoUsers.length > 0
      ? demoUsers[0].user_id
      : '606a91cb-833a-44fd-9cbb-4fffda2f07aa'

  const testCampaign: Campaign = {
    id: generateCampaignId(),
    name: 'Test in 5 min (Berlin/UTC)',
    enabled: true,
    trigger: 'time_absolute',
    time_config: {
      day_of_week,
      hour,
      minute,
      timezone: 'UTC',
    },
    skip_if_subscribed: true,
    run_once_per_user: false,
    delay_seconds: 0,
    delay_between_slots_seconds: 0,
    target_selection: {
      mode: 'direct',
      flow_slots: [
        { demo_user_id: firstDemoId, message: null },
      ],
    },
    rate_limit_hours: 24,
    max_requests_per_user_per_day: 10,
    requests_per_trigger: 1,
    min_days_since_signup: 0,
    exclude_promoter: true,
    include_message: false,
    message_template: null,
  }

  const newConfig: CampaignsConfig = {
    campaigns: [...config.campaigns, testCampaign],
  }

  try {
    const updated = await updateDemoReengagementConfig(newConfig)
    return NextResponse.json({
      success: true,
      config: updated,
      scheduled_at_utc: { day_of_week, hour, minute },
      scheduled_in_minutes: 5,
    })
  } catch (e) {
    console.error('add-test-campaign update:', e)
    return NextResponse.json(
      { error: 'Failed to save config' },
      { status: 500 }
    )
  }
}

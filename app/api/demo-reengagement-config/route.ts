import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'
import {
  getDemoReengagementConfig,
  updateDemoReengagementConfig,
  type DemoReengagementConfig,
} from '@/lib/database/demo-reengagement-config'

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
    const config: DemoReengagementConfig = {
      rate_limit_hours: typeof body.rate_limit_hours === 'number' ? body.rate_limit_hours : 24,
      max_requests_per_user_per_day:
        typeof body.max_requests_per_user_per_day === 'number' ? body.max_requests_per_user_per_day : 1,
      include_message: typeof body.include_message === 'boolean' ? body.include_message : false,
      message_template:
        body.message_template === null || typeof body.message_template === 'string'
          ? body.message_template
          : null,
      min_days_since_signup:
        typeof body.min_days_since_signup === 'number' ? body.min_days_since_signup : 0,
      exclude_promoter: typeof body.exclude_promoter === 'boolean' ? body.exclude_promoter : true,
      match_opposite_gender:
        typeof body.match_opposite_gender === 'boolean' ? body.match_opposite_gender : false,
    }

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

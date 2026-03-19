import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/user-roles'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = await getUserRole(user.id)
    if (role !== 'admin' && role !== 'dev' && role !== 'developer') {
      return NextResponse.json(
        { error: 'Only admin or developer can send test notifications' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { user_id, notification_type } = body as { user_id?: string; notification_type?: string }

    if (!user_id || !notification_type) {
      return NextResponse.json(
        { error: 'user_id and notification_type are required' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server not configured for Edge Function calls' },
        { status: 503 }
      )
    }

    const { data, error } = await supabase.functions.invoke('send-push-notifications', {
      body: {
        test: true,
        user_id,
        notification_type,
      },
    })

    if (error) {
      console.error('Send test push error:', error)
      return NextResponse.json(
        { error: error.message || 'Edge Function failed' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Test push sent.',
      data: data ?? undefined,
    })
  } catch (err) {
    console.error('Send test push:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

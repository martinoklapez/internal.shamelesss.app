import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'

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

    const role = await getUserRole(user.id)
    if (role !== 'admin' && role !== 'dev' && role !== 'developer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Service role key is not configured on the server' },
        { status: 500 }
      )
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profiles, error } = await admin
      .from('profiles')
      .select(
        'user_id, name, username, profile_picture_url, age, country_code, gender, instagram_handle, snapchat_handle, connection_count, created_at, updated_at'
      )
      .order('created_at', { ascending: false })

    if (error) {
      console.error('profiles-cleanup list:', error)
      return NextResponse.json(
        { error: `Failed to load profiles: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ profiles: profiles ?? [] }, { status: 200 })
  } catch (e) {
    console.error('profiles-cleanup list:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

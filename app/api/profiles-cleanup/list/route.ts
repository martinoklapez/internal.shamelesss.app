import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const demoOnly =
      searchParams.get('demo_only') === '1' || searchParams.get('demo_only') === 'true'

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

    let demoUserIds: string[] | null = null
    if (demoOnly) {
      const { data: roleRows, error: roleErr } = await admin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'demo')

      if (roleErr) {
        console.error('profiles-cleanup list demo filter:', roleErr)
        return NextResponse.json(
          { error: `Failed to load demo roles: ${roleErr.message}` },
          { status: 500 }
        )
      }
      demoUserIds = [...new Set((roleRows || []).map((r) => String(r.user_id)).filter(Boolean))]
      if (demoUserIds.length === 0) {
        return NextResponse.json({ profiles: [], demo_only: true }, { status: 200 })
      }
    }

    let query = admin
      .from('profiles')
      .select(
        'user_id, name, username, profile_picture_url, age, country_code, gender, instagram_handle, snapchat_handle, connection_count, created_at, updated_at'
      )
      .order('created_at', { ascending: false })

    if (demoUserIds) {
      query = query.in('user_id', demoUserIds)
    }

    const { data: profiles, error } = await query

    if (error) {
      console.error('profiles-cleanup list:', error)
      return NextResponse.json(
        { error: `Failed to load profiles: ${error.message}` },
        { status: 500 }
      )
    }

    const rows = profiles ?? []
    const ids = rows.map((p) => p.user_id)
    const roleByUserId = new Map<string, string>()
    if (ids.length > 0) {
      const { data: roleRows, error: rolesErr } = await admin
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', ids)

      if (rolesErr) {
        console.error('profiles-cleanup list roles:', rolesErr)
        return NextResponse.json(
          { error: `Failed to load roles: ${rolesErr.message}` },
          { status: 500 }
        )
      }
      for (const r of roleRows || []) {
        roleByUserId.set(String(r.user_id), String(r.role))
      }
    }

    const profilesWithRoles = rows.map((p) => ({
      ...p,
      role: roleByUserId.get(p.user_id) ?? null,
    }))

    return NextResponse.json(
      { profiles: profilesWithRoles, demo_only: demoOnly || undefined },
      { status: 200 }
    )
  } catch (e) {
    console.error('profiles-cleanup list:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

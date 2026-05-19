import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserRole } from '@/lib/user-roles'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Roles accepted by UserDialog / users update API */
const DIALOG_ROLES = new Set(['admin', 'dev', 'developer', 'promoter', 'tester', 'demo', 'user'])

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user: caller },
    } = await supabase.auth.getUser()

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const callerRole = await getUserRole(caller.id)
    if (callerRole !== 'admin' && callerRole !== 'dev' && callerRole !== 'developer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userId = new URL(request.url).searchParams.get('user_id')?.trim()
    if (!userId || !UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'user_id must be a valid UUID' }, { status: 400 })
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

    const [profileRes, roleRes, authResult] = await Promise.all([
      admin
        .from('profiles')
        .select(
          'user_id, name, username, profile_picture_url, age, country_code, gender, instagram_handle, snapchat_handle, connection_count, created_at, updated_at'
        )
        .eq('user_id', userId)
        .maybeSingle(),
      admin.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      admin.auth.admin.getUserById(userId),
    ])

    const profileErr = profileRes.error
    const profile = profileRes.data
    const roleRow = roleRes.data

    if (profileErr) {
      console.error('users/detail profile:', profileErr)
      return NextResponse.json(
        { error: `Failed to load profile: ${profileErr.message}` },
        { status: 500 }
      )
    }

    const authUser = authResult.data?.user
    if (!profile && !authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const rawRole = typeof roleRow?.role === 'string' ? roleRow.role.trim() : ''
    const role = DIALOG_ROLES.has(rawRole) ? rawRole : 'user'

    const p = profile as {
      user_id: string
      name?: string | null
      username?: string | null
      profile_picture_url?: string | null
      age?: number | null
      country_code?: string | null
      gender?: string | null
      instagram_handle?: string | null
      snapchat_handle?: string | null
      connection_count?: number | null
      created_at?: string | null
      updated_at?: string | null
    } | null

    return NextResponse.json({
      user: {
        id: userId,
        name: p?.name ?? null,
        username: p?.username ?? null,
        role,
        profile_picture_url: p?.profile_picture_url ?? null,
        age: p?.age ?? null,
        country_code: p?.country_code ?? null,
        gender: p?.gender ?? null,
        instagram_handle: p?.instagram_handle ?? null,
        snapchat_handle: p?.snapchat_handle ?? null,
        connection_count: p?.connection_count ?? 0,
        created_at: p?.created_at ?? null,
        updated_at: p?.updated_at ?? null,
        email: authUser?.email ?? null,
      },
    })
  } catch (e) {
    console.error('users/detail:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

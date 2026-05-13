import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
  DEMO_USERS_BACKUP_FORMAT_VERSION,
  type DemoUserBackupEntry,
  type DemoUsersBackupFile,
} from '@/lib/demo-users-backup'
import { getUserRole } from '@/lib/user-roles'

export const dynamic = 'force-dynamic'

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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Service role key is not configured on the server' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const allDemo = body?.all_demo === true
    const rawIds = body?.user_ids

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let userIds: string[] = []
    if (allDemo) {
      const { data: rows, error } = await admin.from('user_roles').select('user_id').eq('role', 'demo')
      if (error) {
        return NextResponse.json({ error: `Could not load demo roles: ${error.message}` }, { status: 500 })
      }
      userIds = [...new Set((rows || []).map((r) => String(r.user_id)).filter(Boolean))]
    } else {
      if (!Array.isArray(rawIds) || rawIds.length === 0) {
        return NextResponse.json(
          { error: 'Provide user_ids or set all_demo to true' },
          { status: 400 }
        )
      }
      userIds = [...new Set(rawIds.map((id: unknown) => String(id)).filter(Boolean))]
    }

    if (userIds.length === 0) {
      const empty: DemoUsersBackupFile = {
        format_version: DEMO_USERS_BACKUP_FORMAT_VERSION,
        exported_at: new Date().toISOString(),
        users: [],
      }
      return NextResponse.json({ backup: empty }, { status: 200 })
    }

    const { data: roleRows, error: roleErr } = await admin
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds)

    if (roleErr) {
      return NextResponse.json({ error: `Could not load roles: ${roleErr.message}` }, { status: 500 })
    }

    const roleByUserId = new Map<string, string>()
    for (const r of roleRows || []) {
      roleByUserId.set(String(r.user_id), String(r.role))
    }

    const users: DemoUserBackupEntry[] = []

    for (const id of userIds) {
      const { data: authData, error: authErr } = await admin.auth.admin.getUserById(id)
      if (authErr || !authData?.user) {
        return NextResponse.json(
          { error: `Auth user not found: ${id}${authErr?.message ? ` — ${authErr.message}` : ''}` },
          { status: 400 }
        )
      }
      const email = authData.user.email?.trim() || null
      const phone = authData.user.phone?.trim() || null

      const { data: profileRow } = await admin.from('profiles').select('*').eq('user_id', id).maybeSingle()

      let profile: Record<string, unknown> | null = null
      if (profileRow && typeof profileRow === 'object') {
        profile = { ...profileRow } as Record<string, unknown>
      }

      const exportedRole = allDemo ? 'demo' : (roleByUserId.get(id) ?? 'user')

      users.push({
        email,
        phone: phone ?? null,
        role: exportedRole,
        former_user_id: id,
        profile,
      })
    }

    const backup: DemoUsersBackupFile = {
      format_version: DEMO_USERS_BACKUP_FORMAT_VERSION,
      exported_at: new Date().toISOString(),
      users,
    }

    return NextResponse.json({ backup }, { status: 200 })
  } catch (e) {
    console.error('demo-export:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'
import { isProfilesBackupPasscodeConfigured, getProfilesBackupPasscodeMeta } from '@/lib/profiles-backup-passcode-server'

export const dynamic = 'force-dynamic'

/** Supabase REST builds very long URLs for `.in()`; chunked requests avoid fetch failures at scale. */
const USER_ID_IN_CHUNK = 100

function chunkIds(ids: string[]): string[][] {
  const uniq = [...new Set(ids.map((id) => String(id)).filter(Boolean))]
  const out: string[][] = []
  for (let i = 0; i < uniq.length; i += USER_ID_IN_CHUNK) {
    out.push(uniq.slice(i, i + USER_ID_IN_CHUNK))
  }
  return out
}

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
        return NextResponse.json(
          {
            profiles: [],
            demo_only: true,
            backup_passcode_configured: isProfilesBackupPasscodeConfigured(),
            backup_passcode_length: getProfilesBackupPasscodeMeta().length,
          },
          { status: 200 }
        )
      }
    }

    const PROFILE_SELECT =
      'user_id, name, username, profile_picture_url, age, country_code, gender, instagram_handle, snapchat_handle, connection_count, created_at, updated_at'

    let rows: {
      user_id: string
      name: string | null
      username: string | null
      profile_picture_url: string | null
      age: number | null
      country_code: string | null
      gender: string | null
      instagram_handle: string | null
      snapchat_handle: string | null
      connection_count: number | null
      created_at: string | null
      updated_at: string | null
    }[] = []

    if (demoUserIds && demoUserIds.length > 0) {
      for (const slice of chunkIds(demoUserIds)) {
        const { data: chunk, error: chunkErr } = await admin
          .from('profiles')
          .select(PROFILE_SELECT)
          .in('user_id', slice)

        if (chunkErr) {
          console.error('profiles-cleanup list profiles chunk:', chunkErr)
          return NextResponse.json(
            { error: `Failed to load profiles: ${chunkErr.message}` },
            { status: 500 }
          )
        }
        rows.push(...(chunk ?? []))
      }
      rows.sort((a, b) => {
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        return tb - ta
      })
    } else {
      const { data: profiles, error } = await admin
        .from('profiles')
        .select(PROFILE_SELECT)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('profiles-cleanup list:', error)
        return NextResponse.json(
          { error: `Failed to load profiles: ${error.message}` },
          { status: 500 }
        )
      }
      rows = profiles ?? []
    }
    const ids = rows.map((p) => p.user_id)
    const roleByUserId = new Map<string, string>()
    try {
      for (const slice of chunkIds(ids)) {
        const { data: roleRows, error: rolesErr } = await admin
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', slice)

        if (rolesErr) {
          console.error('profiles-cleanup list roles chunk:', rolesErr)
          return NextResponse.json(
            { error: `Failed to load roles: ${rolesErr.message}` },
            { status: 500 }
          )
        }
        for (const r of roleRows || []) {
          roleByUserId.set(String(r.user_id), String(r.role))
        }
      }
    } catch (loadRolesErr: unknown) {
      const msg = loadRolesErr instanceof Error ? loadRolesErr.message : String(loadRolesErr)
      console.error('profiles-cleanup list roles:', loadRolesErr)
      return NextResponse.json({ error: `Failed to load roles: ${msg}` }, { status: 500 })
    }

    const profilesWithRoles = rows.map((p) => ({
      ...p,
      role: roleByUserId.get(p.user_id) ?? null,
    }))

    const backupMeta = getProfilesBackupPasscodeMeta()

    return NextResponse.json(
      {
        profiles: profilesWithRoles,
        demo_only: demoOnly || undefined,
        backup_passcode_configured: backupMeta.configured,
        backup_passcode_length: backupMeta.length,
      },
      { status: 200 }
    )
  } catch (e) {
    console.error('profiles-cleanup list:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

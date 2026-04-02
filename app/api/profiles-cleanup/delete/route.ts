import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'

/**
 * Roles we refuse to delete. Must match DB enum `user_role_type` — `dev` exists in
 * app RBAC only and is not a valid enum value, so it must never be passed to `.in('role', ...)`.
 */
const PROTECTED_ROLES_IN_DB = new Set(['admin', 'developer'])

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
    const rawIds = body?.user_ids
    const allowStaff = body?.allow_staff === true
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json(
        { error: 'Expected a non-empty user_ids array' },
        { status: 400 }
      )
    }

    const userIds = [...new Set(rawIds.map((id: unknown) => String(id)).filter(Boolean))]
    if (userIds.length === 0) {
      return NextResponse.json({ error: 'No valid user ids' }, { status: 400 })
    }

    const skipped: { user_id: string; reason: string }[] = []
    const toDelete: string[] = []

    for (const id of userIds) {
      if (id === user.id) {
        skipped.push({ user_id: id, reason: 'cannot_delete_self' })
        continue
      }
      toDelete.push(id)
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (toDelete.length > 0) {
      const { data: roleRows, error: staffErr } = await admin
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', toDelete)

      if (staffErr) {
        console.error('profiles-cleanup delete staff check:', staffErr)
        return NextResponse.json(
          { error: `Could not verify roles: ${staffErr.message}` },
          { status: 500 }
        )
      }

      const staffIds = new Set(
        (roleRows || [])
          .filter((r) => PROTECTED_ROLES_IN_DB.has(String(r.role)))
          .map((r) => r.user_id)
      )
      const allowed: string[] = []
      for (const id of toDelete) {
        if (!allowStaff && staffIds.has(id)) {
          skipped.push({ user_id: id, reason: 'protected_role' })
        } else {
          allowed.push(id)
        }
      }

      const deleted: string[] = []
      const failed: { user_id: string; error: string }[] = []

      for (const id of allowed) {
        const { error: demoteErr } = await admin
          .from('user_roles')
          .update({ role: 'user' })
          .eq('user_id', id)
          .in('role', ['admin', 'developer'])

        if (demoteErr) {
          failed.push({
            user_id: id,
            error: `Could not demote admin/developer to user: ${demoteErr.message}`,
          })
          continue
        }

        const { error: profileErr } = await admin.from('profiles').delete().eq('user_id', id)
        if (profileErr) {
          failed.push({ user_id: id, error: profileErr.message })
          continue
        }

        const { error: rolesErr } = await admin.from('user_roles').delete().eq('user_id', id)
        if (rolesErr) {
          console.warn('profiles-cleanup user_roles delete:', id, rolesErr.message)
        }

        const { error: authErr } = await admin.auth.admin.deleteUser(id)
        if (authErr) {
          failed.push({
            user_id: id,
            error: `Profile removed but auth delete failed: ${authErr.message}`,
          })
          continue
        }

        deleted.push(id)
      }

      return NextResponse.json({ deleted, failed, skipped }, { status: 200 })
    }

    return NextResponse.json({ deleted: [], failed: [], skipped }, { status: 200 })
  } catch (e) {
    console.error('profiles-cleanup delete:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

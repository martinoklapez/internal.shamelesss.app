import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRole, type UserRole } from '@/lib/user-roles'

const DEVICE_MANAGER_ROLES: UserRole[] = ['admin', 'dev', 'developer', 'promoter']

export async function requireDeviceManagerUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const role = await getUserRole(user.id)
  if (!role || !DEVICE_MANAGER_ROLES.includes(role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true as const, userId: user.id, role }
}

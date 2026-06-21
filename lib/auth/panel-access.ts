import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole, type UserRole } from '@/lib/user-roles'
import { isPhoneAdmin } from '@/lib/api/phone-number-auth'

const PANEL_ROLES: UserRole[] = ['admin', 'dev', 'developer', 'promoter']

export const getPageUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export const getPageUserRole = cache(async () => {
  const user = await getPageUser()
  if (!user) return null
  return getUserRole(user.id)
})

/** Auth + role gate for panel pages. Dedupes within a single request via React cache. */
export async function requirePanelUser() {
  const user = await getPageUser()
  if (!user) redirect('/')

  const role = await getPageUserRole()
  if (!role || !PANEL_ROLES.includes(role)) redirect('/')

  return { user, role }
}

export async function requirePhoneNumbersPage() {
  const { user, role } = await requirePanelUser()
  return { user, role, isPhoneAdmin: isPhoneAdmin(role) }
}

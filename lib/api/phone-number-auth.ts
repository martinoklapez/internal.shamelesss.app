import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireDeviceManagerUser } from '@/lib/api/device-manager-auth'
import type { UserRole } from '@/lib/user-roles'

export const PHONE_ADMIN_ROLES: UserRole[] = ['admin', 'dev', 'developer']

export function isPhoneAdmin(role: UserRole): boolean {
  return PHONE_ADMIN_ROLES.includes(role)
}

export async function canAccessPhoneNumber(
  supabase: SupabaseClient,
  phoneNumberId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_access_phone_number', {
    p_phone_id: phoneNumberId,
  })

  if (error) {
    console.error('can_access_phone_number RPC failed:', error.message)
    return false
  }

  return data === true
}

export async function requirePhoneAdmin() {
  const auth = await requireDeviceManagerUser()
  if (!auth.ok) return auth

  if (!isPhoneAdmin(auth.role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return auth
}

export async function requirePhoneNumberAccess(phoneNumberId: string) {
  const auth = await requireDeviceManagerUser()
  if (!auth.ok) return auth

  if (isPhoneAdmin(auth.role)) {
    return { ok: true as const, userId: auth.userId, role: auth.role }
  }

  const supabase = await createClient()
  const allowed = await canAccessPhoneNumber(supabase, phoneNumberId)
  if (!allowed) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true as const, userId: auth.userId, role: auth.role }
}

export async function getDeviceManagerId(
  supabase: SupabaseClient,
  deviceId: number
): Promise<string | null> {
  const { data } = await supabase
    .from('devices')
    .select('manager_id')
    .eq('id', deviceId)
    .maybeSingle()

  return data?.manager_id ?? null
}

export async function getManagerIdForICloudProfile(
  supabase: SupabaseClient,
  icloudProfileId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('icloud_profiles')
    .select('device_id')
    .eq('id', icloudProfileId)
    .maybeSingle()

  if (!data?.device_id) return null
  return getDeviceManagerId(supabase, data.device_id)
}

export async function getManagerIdForSocialAccount(
  supabase: SupabaseClient,
  accountId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('social_accounts')
    .select('device_id')
    .eq('id', accountId)
    .maybeSingle()

  if (!data?.device_id) return null
  return getDeviceManagerId(supabase, data.device_id)
}

/** When linking a phone to a device identity, assign inventory to the device manager. */
export async function resolveAutoAssignUserId(
  supabase: SupabaseClient,
  opts: {
    icloudProfileId?: string | null
    socialAccountId?: string | null
    fallbackUserId: string
  }
): Promise<string> {
  if (opts.icloudProfileId) {
    const managerId = await getManagerIdForICloudProfile(supabase, opts.icloudProfileId)
    if (managerId) return managerId
  }

  if (opts.socialAccountId) {
    const managerId = await getManagerIdForSocialAccount(supabase, opts.socialAccountId)
    if (managerId) return managerId
  }

  return opts.fallbackUserId
}

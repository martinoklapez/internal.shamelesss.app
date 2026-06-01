import { SHAMELESSS_CONFIG } from '../config.js'

function authHeaders(accessToken) {
  return {
    apikey: SHAMELESSS_CONFIG.supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

function publicHeaders() {
  return {
    apikey: SHAMELESSS_CONFIG.supabaseAnonKey,
    'Content-Type': 'application/json',
  }
}

export async function signInWithPassword(email, password) {
  const res = await fetch(
    `${SHAMELESSS_CONFIG.supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: publicHeaders(),
      body: JSON.stringify({ email, password }),
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error_description ?? data.msg ?? data.message ?? 'Sign in failed')
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: data.user,
  }
}

export async function refreshSession(refreshToken) {
  const res = await fetch(
    `${SHAMELESSS_CONFIG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
    {
      method: 'POST',
      headers: publicHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken }),
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return null
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: data.user,
  }
}

export async function fetchAuthUser(accessToken) {
  const res = await fetch(`${SHAMELESSS_CONFIG.supabaseUrl}/auth/v1/user`, {
    headers: authHeaders(accessToken),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return null
  return data
}

/** Staff avatar in the app header comes from public.profiles, not auth metadata. */
export async function fetchStaffProfile(accessToken, userId) {
  const params = new URLSearchParams({
    select: 'name,profile_picture_url',
    user_id: `eq.${userId}`,
  })
  const res = await fetch(
    `${SHAMELESSS_CONFIG.supabaseUrl}/rest/v1/profiles?${params}`,
    {
      headers: {
        ...authHeaders(accessToken),
        Accept: 'application/json',
      },
    }
  )
  const rows = await res.json().catch(() => [])
  if (!res.ok || !Array.isArray(rows) || rows.length === 0) return null
  const row = rows[0]
  return {
    name: row.name ?? null,
    profile_picture_url: row.profile_picture_url ?? null,
  }
}

export async function fetchUserRole(accessToken, userId) {
  const params = new URLSearchParams({
    select: 'role',
    user_id: `eq.${userId}`,
  })
  const res = await fetch(
    `${SHAMELESSS_CONFIG.supabaseUrl}/rest/v1/user_roles?${params}`,
    {
      headers: {
        ...authHeaders(accessToken),
        Accept: 'application/json',
      },
    }
  )
  const rows = await res.json().catch(() => [])
  if (!res.ok || !Array.isArray(rows) || rows.length === 0) return null
  return rows[0].role ?? null
}

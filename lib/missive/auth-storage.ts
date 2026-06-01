const ACCESS_KEY = 'creator_pipeline_access_token'
const REFRESH_KEY = 'creator_pipeline_refresh_token'

function hasMissiveStore(): boolean {
  return typeof window !== 'undefined' && typeof window.Missive?.storeGet === 'function'
}

async function storeGet(key: string): Promise<string | null> {
  if (hasMissiveStore()) {
    return window.Missive!.storeGet(key)
  }
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(key)
}

async function storeSet(key: string, value: string): Promise<void> {
  if (hasMissiveStore()) {
    await window.Missive!.storeSet(key, value)
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(key, value)
  }
}

async function storeRemove(key: string): Promise<void> {
  if (window.Missive?.storeRemove) {
    await window.Missive.storeRemove(key)
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(key)
  }
}

export type MissiveAuthSession = {
  access_token: string
  refresh_token: string
}

export async function loadMissiveAuthSession(): Promise<MissiveAuthSession | null> {
  const access_token = (await storeGet(ACCESS_KEY))?.trim()
  const refresh_token = (await storeGet(REFRESH_KEY))?.trim()
  if (!access_token || !refresh_token) return null
  return { access_token, refresh_token }
}

export async function saveMissiveAuthSession(session: MissiveAuthSession): Promise<void> {
  await storeSet(ACCESS_KEY, session.access_token)
  await storeSet(REFRESH_KEY, session.refresh_token)
}

export async function clearMissiveAuthSession(): Promise<void> {
  await storeRemove(ACCESS_KEY)
  await storeRemove(REFRESH_KEY)
}

export async function signInMissiveWithPassword(
  email: string,
  password: string
): Promise<MissiveAuthSession & { user: Record<string, unknown> }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Supabase is not configured on this deployment.')
  }

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const msg =
      (data.error_description as string) ??
      (data.msg as string) ??
      (data.message as string) ??
      'Sign in failed'
    throw new Error(msg)
  }

  const access_token = data.access_token as string
  const refresh_token = data.refresh_token as string
  const user = data.user as Record<string, unknown>
  if (!access_token || !refresh_token) {
    throw new Error('Sign in failed — missing tokens')
  }

  const session = { access_token, refresh_token }
  await saveMissiveAuthSession(session)
  return { ...session, user }
}

export async function refreshMissiveSession(
  refreshToken: string
): Promise<MissiveAuthSession | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) return null

  const access_token = data.access_token as string
  const refresh_token = (data.refresh_token as string) ?? refreshToken
  if (!access_token) return null

  const session = { access_token, refresh_token }
  await saveMissiveAuthSession(session)
  return session
}

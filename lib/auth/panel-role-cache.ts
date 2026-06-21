import type { UserRole } from '@/lib/user-roles'

export const PANEL_ROLE_COOKIE = 'panel-role-cache'
const PANEL_ROLES: UserRole[] = ['admin', 'dev', 'developer', 'promoter']
const CACHE_MAX_AGE = 60 * 5 // 5 minutes

function getSigningSecret(): string {
  return (
    process.env.MIDDLEWARE_ROLE_SECRET ||
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}:panel-role`
  )
}

async function signValue(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSigningSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export function isPanelRole(role: string): role is UserRole {
  return PANEL_ROLES.includes(role as UserRole)
}

export async function createPanelRoleCookieValue(userId: string, role: UserRole): Promise<string> {
  const payload = `${userId}:${role}`
  const signature = await signValue(payload)
  return `${payload}:${signature}`
}

export async function readPanelRoleFromCookie(
  cookieValue: string | undefined,
  userId: string
): Promise<UserRole | null> {
  if (!cookieValue) return null

  const parts = cookieValue.split(':')
  if (parts.length < 3) return null

  const signature = parts.pop()
  const role = parts.pop()
  const cachedUserId = parts.join(':')

  if (!signature || !role || cachedUserId !== userId || !isPanelRole(role)) {
    return null
  }

  const payload = `${userId}:${role}`
  const expected = await signValue(payload)
  if (!timingSafeEqual(expected, signature)) {
    return null
  }

  return role
}

export function panelRoleCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CACHE_MAX_AGE,
  }
}

export { PANEL_ROLES }

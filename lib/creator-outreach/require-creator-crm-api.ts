import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/lib/user-roles'
import { getUserRole } from '@/lib/user-roles'

const CRM_API_ROLES: UserRole[] = ['admin', 'dev', 'developer']

function extractBearerToken(request?: Request): string | null {
  if (!request) return null
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  return token || null
}

async function getCrmRoleForUserId(userId: string): Promise<UserRole | null> {
  try {
    const supabase = getAdminSupabaseClient()
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()
    if (error || !data) return null
    return data.role as UserRole
  } catch (error) {
    console.error('getCrmRoleForUserId:', error)
    return null
  }
}

async function authFromBearerToken(
  token: string
): Promise<
  | { userId: string }
  | NextResponse
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const client = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token)

  if (authError) {
    console.error('requireCreatorCrmApi bearer getUser:', authError)
    return NextResponse.json(
      {
        error:
          'Invalid or expired session. Sign in again in the extension.',
      },
      { status: 401 }
    )
  }

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized — sign in again to use Creator Pipeline.' },
      { status: 401 }
    )
  }

  const userRole = await getCrmRoleForUserId(user.id)
  if (!userRole || !CRM_API_ROLES.includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { userId: user.id }
}

export async function requireCreatorCrmApi(
  request?: Request
): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | NextResponse
> {
  const bearer = extractBearerToken(request)
  if (bearer) {
    const bearerAuth = await authFromBearerToken(bearer)
    if (bearerAuth instanceof NextResponse) return bearerAuth
    const supabase = await createClient()
    return { supabase, userId: bearerAuth.userId }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('requireCreatorCrmApi getUser:', authError)
    return NextResponse.json(
      {
        error:
          'Could not verify your session (Supabase auth unreachable). Wait a moment and retry, or sign out and sign in again.',
      },
      { status: 503 }
    )
  }

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized — sign in again to use Creator Pipeline.' },
      { status: 401 }
    )
  }

  const userRole = await getUserRole(user.id)
  if (!userRole || !CRM_API_ROLES.includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { supabase, userId: user.id }
}

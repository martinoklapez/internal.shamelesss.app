import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/user-roles'

export async function requireCreatorCrmApi(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | NextResponse
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = await getUserRole(user.id)
  if (userRole !== 'admin' && userRole !== 'dev' && userRole !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { supabase, userId: user.id }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/user-roles'
import { getPositionsByGameId } from '@/lib/database/positions'

export const dynamic = 'force-dynamic'

/** GET: List positions for ScratchDates (all categories) for onboarding image picker */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = await getUserRole(user.id)
    const allowedRoles = ['admin', 'dev', 'developer']
    if (!userRole || !allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const positions = await getPositionsByGameId('scratch-dates')
    return NextResponse.json({ positions }, { status: 200 })
  } catch (error: unknown) {
    console.error('Error in scratch-dates-positions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

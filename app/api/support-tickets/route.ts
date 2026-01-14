import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'
import { getSupportTickets, getSupportTicketStats } from '@/lib/database/support-tickets'

export async function GET(request: Request) {
  try {
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

    const { searchParams } = new URL(request.url)
    const stats = searchParams.get('stats')

    if (stats === 'true') {
      const ticketStats = await getSupportTicketStats()
      return NextResponse.json(ticketStats, { status: 200 })
    }

    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)

    const result = await getSupportTickets(
      {
        status,
        search,
      },
      page,
      pageSize
    )

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('Error in get support tickets route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

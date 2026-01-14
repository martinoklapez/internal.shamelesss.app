import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'
import { getReports, getReportStats } from '@/lib/database/reports'

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
    const statsOnly = searchParams.get('stats') === 'true'

    if (statsOnly) {
      const stats = await getReportStats()
      return NextResponse.json(stats, { status: 200 })
    }

    // Parse filters
    const status = searchParams.get('status') as 'pending' | 'reviewed' | 'resolved' | 'dismissed' | 'open' | 'closed' | null
    const type = searchParams.get('type') as 'user' | 'message' | 'image' | null
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)

    const result = await getReports(
      {
        status: status || undefined,
        type: type || undefined,
        startDate,
        endDate,
        search,
      },
      page,
      pageSize
    )

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('Error in reports route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


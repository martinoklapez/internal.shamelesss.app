import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'
import { getSupportTicketById, updateSupportTicketStatus, updateSupportTicketAdminResponse } from '@/lib/database/support-tickets'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

    const resolvedParams = await Promise.resolve(params)
    const ticket = await getSupportTicketById(resolvedParams.id)

    if (!ticket) {
      return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 })
    }

    return NextResponse.json(ticket, { status: 200 })
  } catch (error: any) {
    console.error('Error in get support ticket route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

    const resolvedParams = await Promise.resolve(params)
    const body = await request.json()
    const { status, admin_response } = body

    // Handle status update
    if (status) {
      if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be one of: open, in_progress, resolved, closed' },
          { status: 400 }
        )
      }
      const updatedTicket = await updateSupportTicketStatus(resolvedParams.id, status, user.id)
      return NextResponse.json(updatedTicket, { status: 200 })
    }

    // Handle admin_response update
    if (admin_response !== undefined) {
      const updatedTicket = await updateSupportTicketAdminResponse(resolvedParams.id, admin_response)
      return NextResponse.json(updatedTicket, { status: 200 })
    }

    return NextResponse.json(
      { error: 'Either status or admin_response must be provided' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error in update support ticket route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

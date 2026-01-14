import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'
import { getRefundRequestById, updateRefundRequestStatus, updateRefundRequestAdminResponse } from '@/lib/database/refund-requests'

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
    const request = await getRefundRequestById(resolvedParams.id)

    if (!request) {
      return NextResponse.json({ error: 'Refund request not found' }, { status: 404 })
    }

    return NextResponse.json(request, { status: 200 })
  } catch (error: any) {
    console.error('Error in get refund request route:', error)
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
      if (!['pending', 'approved', 'rejected', 'processed'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be one of: pending, approved, rejected, processed' },
          { status: 400 }
        )
      }
      const updatedRequest = await updateRefundRequestStatus(resolvedParams.id, status, user.id)
      return NextResponse.json(updatedRequest, { status: 200 })
    }

    // Handle admin_response update
    if (admin_response !== undefined) {
      const updatedRequest = await updateRefundRequestAdminResponse(resolvedParams.id, admin_response)
      return NextResponse.json(updatedRequest, { status: 200 })
    }

    return NextResponse.json(
      { error: 'Either status or admin_response must be provided' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error in update refund request route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

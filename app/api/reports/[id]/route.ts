import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'
import { getReportById, updateReportStatus, updateReportAdminResponse, generateEvidenceImageSignedUrl } from '@/lib/database/reports'

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
    const report = await getReportById(resolvedParams.id)

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Debug logging
    console.log('Report connection:', report.connection)
    console.log('Report friend_requests:', report.friend_requests)

    // Generate signed URL for evidence image if it exists
    let evidenceImageUrl = report.evidence_image_url
    if (report.evidence_image_storage_path && !evidenceImageUrl) {
      try {
        evidenceImageUrl = await generateEvidenceImageSignedUrl(report.evidence_image_storage_path)
      } catch (error) {
        console.error('Error generating signed URL for evidence image:', error)
        // Continue without the signed URL
      }
    }

    return NextResponse.json(
      {
        ...report,
        evidence_image_url: evidenceImageUrl || report.evidence_image_url,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error in get report route:', error)
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
      if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be one of: pending, reviewed, resolved, dismissed' },
          { status: 400 }
        )
      }
      const updatedReport = await updateReportStatus(resolvedParams.id, status, user.id)
      return NextResponse.json(updatedReport, { status: 200 })
    }

    // Handle admin_response update
    if (admin_response !== undefined) {
      const updatedReport = await updateReportAdminResponse(resolvedParams.id, admin_response)
      return NextResponse.json(updatedReport, { status: 200 })
    }

    return NextResponse.json(
      { error: 'Either status or admin_response must be provided' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error in update report route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextResponse } from 'next/server'
import { confirmQuickAddJob } from '@/lib/database/creator-pipeline/process-quick-add-jobs'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCreatorCrmApi(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await context.params
  let notes = ''
  let force = false
  let allowAuto = false
  try {
    const body = (await request.json().catch(() => ({}))) as {
      notes?: string
      force?: boolean
      allowAuto?: boolean
    }
    notes = body.notes?.trim() ?? ''
    force = Boolean(body.force)
    allowAuto = Boolean(body.allowAuto)
  } catch {
    // notes optional
  }

  try {
    const supabase = getAdminSupabaseClient()
    const result = await confirmQuickAddJob(supabase, id, auth.userId, notes, {
      force,
      allowAuto,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST quick-add confirm:', error)
    const message = error instanceof Error ? error.message : 'Confirm failed'
    const status = message.includes('not found') ? 404 : message.includes('not ready') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

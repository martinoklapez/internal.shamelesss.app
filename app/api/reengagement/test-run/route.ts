import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/api/admin-auth'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { isReengagementTriggerType } from '@/lib/reengagement-types'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as {
      userId?: string
      campaignId?: string
      secret?: string
      /** Mirrors production: superwall-reengagement-webhook passes subscription_cancelled */
      triggerType?: string
    }

    if (!body.userId?.trim()) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const secret =
      body.secret?.trim() ||
      process.env.REENGAGEMENT_SECRET?.trim() ||
      process.env.DEMO_REENGAGEMENT_SECRET?.trim()

    if (!secret) {
      return NextResponse.json(
        { error: 'secret is required (provide in payload or configure REENGAGEMENT_SECRET)' },
        { status: 400 }
      )
    }

    const admin = getAdminSupabaseClient()
    const payload: Record<string, string> = { userId: body.userId.trim(), secret }
    if (body.campaignId?.trim()) payload.campaignId = body.campaignId.trim()
    const tt = body.triggerType?.trim()
    if (tt) {
      if (!isReengagementTriggerType(tt)) {
        return NextResponse.json({ error: 'Invalid triggerType' }, { status: 400 })
      }
      payload.triggerType = tt
    }

    const { data, error } = await admin.functions.invoke('run-reengagement', { body: payload })
    if (error) return NextResponse.json({ error: error.message }, { status: 502 })

    return NextResponse.json({ success: true, result: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

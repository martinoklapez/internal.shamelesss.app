import { NextRequest, NextResponse } from 'next/server'
import { loadCreatorOutreachStoreFromDb } from '@/lib/database/creator-pipeline/load-store'
import { getCreatorPipelineSupabase } from '@/lib/database/creator-pipeline/supabase'
import { lookupMissiveConversationContext } from '@/lib/creator-outreach/lookup-missive-context'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireCreatorCrmApi(request)
  if (auth instanceof NextResponse) return auth

  const conversationId = request.nextUrl.searchParams.get('conversationId')?.trim() ?? ''
  const emailsParam = request.nextUrl.searchParams.get('emails')?.trim()
  const emailSingle = request.nextUrl.searchParams.get('email')?.trim()

  const emails = [
    ...(emailsParam
      ? emailsParam.split(',').map((e) => e.trim()).filter(Boolean)
      : []),
    ...(emailSingle ? [emailSingle] : []),
  ]

  if (!conversationId && emails.length === 0) {
    return NextResponse.json(
      { error: 'Provide conversationId and/or email(s)' },
      { status: 400 }
    )
  }

  let supabase
  try {
    supabase = getCreatorPipelineSupabase()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    const store = await loadCreatorOutreachStoreFromDb(supabase)
    const context = lookupMissiveConversationContext(store, {
      conversationId,
      emails,
    })
    return NextResponse.json(context)
  } catch (error) {
    console.error('GET /api/creator-pipeline/missive-context:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load context' },
      { status: 500 }
    )
  }
}

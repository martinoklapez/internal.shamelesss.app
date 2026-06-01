import { NextResponse } from 'next/server'
import {
  fetchMissiveMessageDetail,
  fetchSentEmailsFromConversations,
} from '@/lib/creator-outreach/fetch-missive-sent-emails'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireCreatorCrmApi(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get('messageId')?.trim()
  const conversationId = searchParams.get('conversationId')?.trim() ?? ''
  const missiveWebUrl = searchParams.get('missiveWebUrl')?.trim() || null

  if (messageId) {
    try {
      const { detail, error } = await fetchMissiveMessageDetail(
        messageId,
        conversationId,
        missiveWebUrl
      )
      if (!detail) {
        return NextResponse.json({ error: error ?? 'Message not found' }, { status: 404 })
      }
      return NextResponse.json({ detail, error })
    } catch (err) {
      console.error('GET /api/creator-pipeline/missive-messages (detail):', err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to load message' },
        { status: 500 }
      )
    }
  }

  const idsParam = searchParams.get('conversationIds')?.trim()
  const conversationIds = idsParam
    ? idsParam.split(',').map((id) => id.trim()).filter(Boolean)
    : []

  try {
    const { emails, error } = await fetchSentEmailsFromConversations(conversationIds)
    return NextResponse.json({ emails, error })
  } catch (err) {
    console.error('GET /api/creator-pipeline/missive-messages:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load Missive messages' },
      { status: 500 }
    )
  }
}

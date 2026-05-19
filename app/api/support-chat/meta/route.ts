import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/api/admin-auth'
import { getSupportChatUserId } from '@/lib/support-chat-config'

export const dynamic = 'force-dynamic'

/** Exposes configured support UUID to admin UI for bubble alignment (not secret). */
export async function GET() {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  const support_user_id = getSupportChatUserId()
  return NextResponse.json({
    support_user_id,
    configured: support_user_id !== null,
  })
}

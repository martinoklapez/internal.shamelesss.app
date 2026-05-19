import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAdminUser } from '@/lib/api/admin-auth'
import { getSupportChatUserId } from '@/lib/support-chat-config'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_CONTENT = 8000

export async function POST(request: Request) {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  const supportId = getSupportChatUserId()
  if (!supportId) {
    return NextResponse.json(
      { error: 'SUPPORT_CHAT_USER_ID is not configured or invalid on the server' },
      { status: 503 }
    )
  }

  let body: { connection_id?: unknown; subject_user_id?: unknown; content?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const connectionId = typeof body.connection_id === 'string' ? body.connection_id.trim() : ''
  const subjectUserId =
    typeof body.subject_user_id === 'string' ? body.subject_user_id.trim().toLowerCase() : ''
  const contentRaw = typeof body.content === 'string' ? body.content : ''
  const content = contentRaw.trim()

  if (!UUID_RE.test(connectionId)) {
    return NextResponse.json({ error: 'connection_id must be a valid UUID' }, { status: 400 })
  }
  if (!UUID_RE.test(subjectUserId)) {
    return NextResponse.json({ error: 'subject_user_id must be a valid UUID' }, { status: 400 })
  }
  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  if (content.length > MAX_CONTENT) {
    return NextResponse.json({ error: `content must be at most ${MAX_CONTENT} characters` }, { status: 400 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service role key is not configured' }, { status: 500 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: connRow, error: connErr } = await admin
    .from('connections')
    .select('id,user_id_1,user_id_2')
    .eq('id', connectionId)
    .maybeSingle()

  if (connErr) {
    console.error('support-chat messages connection:', connErr)
    return NextResponse.json({ error: connErr.message }, { status: 500 })
  }
  if (!connRow) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  const c = connRow as { user_id_1: string | null; user_id_2: string | null }
  const u1 = c.user_id_1 ? String(c.user_id_1).toLowerCase() : ''
  const u2 = c.user_id_2 ? String(c.user_id_2).toLowerCase() : ''
  if (u1 !== subjectUserId && u2 !== subjectUserId) {
    return NextResponse.json(
      { error: 'subject_user_id is not a participant on this connection' },
      { status: 403 }
    )
  }

  const insertPayload: Record<string, unknown> = {
    connection_id: connectionId,
    sender_id: supportId,
    content,
  }

  const { data: inserted, error: insErr } = await admin
    .from('messages')
    .insert(insertPayload)
    .select('id,connection_id,sender_id,content,created_at')
    .maybeSingle()

  if (insErr) {
    console.error('support-chat messages insert:', insErr)
    return NextResponse.json({ error: insErr.message }, { status: 400 })
  }

  return NextResponse.json({ message: inserted })
}

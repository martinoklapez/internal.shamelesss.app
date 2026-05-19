import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAdminUser } from '@/lib/api/admin-auth'
import { getSupportChatUserId } from '@/lib/support-chat-config'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_CONTENT = 8000

function adminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: NextResponse.json({ error: 'Service role key is not configured' }, { status: 500 }) }
  }
  return {
    admin: createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ),
  }
}

async function assertSupportOwnedMessage(messageId: string) {
  const supportId = getSupportChatUserId()
  if (!supportId) {
    return {
      error: NextResponse.json(
        { error: 'SUPPORT_CHAT_USER_ID is not configured or invalid on the server' },
        { status: 503 }
      ),
    }
  }

  const ac = adminClient()
  if ('error' in ac) return ac

  const { data: msg, error } = await ac.admin
    .from('messages')
    .select('id,sender_id')
    .eq('id', messageId)
    .maybeSingle()

  if (error) {
    console.error('support-chat message lookup:', error)
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) }
  }
  if (!msg) {
    return { error: NextResponse.json({ error: 'Message not found' }, { status: 404 }) }
  }

  const sender = msg.sender_id ? String(msg.sender_id).toLowerCase() : ''
  if (sender !== supportId.toLowerCase()) {
    return { error: NextResponse.json({ error: 'Only support-sent messages can be changed here' }, { status: 403 }) }
  }

  return { admin: ac.admin }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  const messageId = typeof params.id === 'string' ? params.id.trim() : ''
  if (!UUID_RE.test(messageId)) {
    return NextResponse.json({ error: 'Invalid message id' }, { status: 400 })
  }

  let body: { content?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const contentRaw = typeof body.content === 'string' ? body.content : ''
  const content = contentRaw.trim()
  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  if (content.length > MAX_CONTENT) {
    return NextResponse.json({ error: `content must be at most ${MAX_CONTENT} characters` }, { status: 400 })
  }

  const gate = await assertSupportOwnedMessage(messageId)
  if ('error' in gate) return gate.error

  const { data: updated, error: updErr } = await gate.admin
    .from('messages')
    .update({ content })
    .eq('id', messageId)
    .select('id,connection_id,sender_id,content,created_at')
    .maybeSingle()

  if (updErr) {
    console.error('support-chat message patch:', updErr)
    return NextResponse.json({ error: updErr.message }, { status: 400 })
  }

  return NextResponse.json({ message: updated })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  const messageId = typeof params.id === 'string' ? params.id.trim() : ''
  if (!UUID_RE.test(messageId)) {
    return NextResponse.json({ error: 'Invalid message id' }, { status: 400 })
  }

  const gate = await assertSupportOwnedMessage(messageId)
  if ('error' in gate) return gate.error

  const { error: delErr } = await gate.admin.from('messages').delete().eq('id', messageId)

  if (delErr) {
    console.error('support-chat message delete:', delErr)
    return NextResponse.json({ error: delErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

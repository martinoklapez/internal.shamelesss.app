import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAdminUser } from '@/lib/api/admin-auth'
import { signedImageUrlsByMessageId } from '@/lib/signed-message-image-urls'
import { activityConnectionTouchesHiddenUser } from '@/lib/activity-hidden-users'
import type {
  ActivityConnectionChatMessageRow,
  ActivityConnectionChatPayload,
  ActivityProfileMini,
} from '@/lib/activity-feed-types'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const USER_CHUNK = 100

function chunkIds(ids: string[]): string[][] {
  const uniq = [...new Set(ids.map((id) => String(id)).filter(Boolean))]
  const out: string[][] = []
  for (let i = 0; i < uniq.length; i += USER_CHUNK) {
    out.push(uniq.slice(i, i + USER_CHUNK))
  }
  return out
}

export async function GET(request: Request) {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  const id = new URL(request.url).searchParams.get('connection_id')?.trim()
  if (!id) {
    return NextResponse.json({ error: 'connection_id is required' }, { status: 400 })
  }
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'connection_id must be a UUID' }, { status: 400 })
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
    .select('id,user_id_1,user_id_2,status,created_at')
    .eq('id', id)
    .maybeSingle()

  if (connErr) {
    console.error('connection-messages:', connErr)
    return NextResponse.json({ error: connErr.message }, { status: 500 })
  }
  if (!connRow) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  const c = connRow as {
    id: string
    user_id_1: string | null
    user_id_2: string | null
    status: string | null
    created_at: string | null
  }

  if (activityConnectionTouchesHiddenUser(c.user_id_1, c.user_id_2)) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  const { data: msgRows, error: msgErr } = await admin
    .from('messages')
    .select(
      'id,connection_id,sender_id,content,image_url,storage_path,storage_bucket,created_at,is_read'
    )
    .eq('connection_id', id)
    .order('created_at', { ascending: true })

  if (msgErr) {
    console.error('connection-messages messages:', msgErr)
    return NextResponse.json({ error: msgErr.message }, { status: 500 })
  }

  const msgs = msgRows ?? []
  const signedByMsgId = await signedImageUrlsByMessageId(admin, msgs as Record<string, unknown>[])
  const senderIds = new Set<string>()
  for (const m of msgs) {
    const s = (m as { sender_id?: string | null }).sender_id
    if (s) senderIds.add(String(s))
  }

  const userIdsNeedingProfile = [...senderIds]
  if (c.user_id_1) userIdsNeedingProfile.push(String(c.user_id_1))
  if (c.user_id_2) userIdsNeedingProfile.push(String(c.user_id_2))

  const profileByUserId = new Map<string, ActivityProfileMini>()
  for (const slice of chunkIds(userIdsNeedingProfile)) {
    if (slice.length === 0) continue
    const { data: profRows, error: pErr } = await admin
      .from('profiles')
      .select('user_id, name, username, profile_picture_url')
      .in('user_id', slice)
    if (pErr) {
      console.error('connection-messages profiles:', pErr)
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }
    for (const p of profRows ?? []) {
      const row = p as ActivityProfileMini
      profileByUserId.set(row.user_id, row)
    }
  }

  const messages: ActivityConnectionChatMessageRow[] = msgs.map((row) => {
    const r = row as {
      id: string
      connection_id: string | null
      sender_id: string | null
      content: string | null
      image_url: string | null
      storage_path: string | null
      storage_bucket: string | null
      created_at: string | null
      is_read: boolean | null
    }
    const sid = r.sender_id
    return {
      id: r.id,
      connection_id: r.connection_id,
      sender_id: r.sender_id,
      content: r.content,
      image_url: r.image_url,
      storage_path: r.storage_path,
      storage_bucket: r.storage_bucket ?? null,
      signed_image_url: signedByMsgId.get(r.id) ?? null,
      created_at: r.created_at,
      is_read: r.is_read ?? null,
      sender: sid ? profileByUserId.get(String(sid)) ?? null : null,
    }
  })

  const user1 = c.user_id_1 ? profileByUserId.get(String(c.user_id_1)) ?? null : null
  const user2 = c.user_id_2 ? profileByUserId.get(String(c.user_id_2)) ?? null : null

  const payload: ActivityConnectionChatPayload = {
    connection: {
      id: c.id,
      user_id_1: c.user_id_1,
      user_id_2: c.user_id_2,
      status: c.status,
      created_at: c.created_at,
      user_1: user1,
      user_2: user2,
    },
    messages,
  }

  return NextResponse.json(payload)
}

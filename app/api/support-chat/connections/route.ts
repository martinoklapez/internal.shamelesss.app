import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdminUser } from '@/lib/api/admin-auth'
import type { ActivityProfileMini } from '@/lib/activity-feed-types'
import { getSupportChatUserId } from '@/lib/support-chat-config'

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

export type SupportChatPeerProfile = ActivityProfileMini & {
  gender: string | null
}

export type SupportChatConnectionRow = {
  id: string
  status: string | null
  created_at: string | null
  peer_user_id: string | null
  peer: SupportChatPeerProfile | null
  /** Most recent message time in thread, if any */
  last_message_at: string | null
  /** Truncated text, or "Photo" for image-only; null when no messages */
  last_message_preview: string | null
}

type LatestMsgRow = {
  connection_id: string
  content: string | null
  image_url: string | null
  storage_path: string | null
  created_at: string | null
}

function previewFromMessage(m: LatestMsgRow): string {
  const text = (m.content ?? '').trim()
  const hasImage = Boolean((m.image_url ?? '').trim() || (m.storage_path ?? '').trim())
  if (text) {
    const single = text.replace(/\s+/g, ' ')
    return single.length > 72 ? `${single.slice(0, 71)}…` : single
  }
  if (hasImage) return 'Photo'
  return '(Empty)'
}

async function fetchLatestMessageByConnectionIds(
  admin: SupabaseClient,
  connectionIds: string[]
): Promise<Map<string, { preview: string; created_at: string | null }>> {
  const out = new Map<string, { preview: string; created_at: string | null }>()
  const chunkSize = 40
  for (let i = 0; i < connectionIds.length; i += chunkSize) {
    const chunk = connectionIds.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map(async (cid) => {
        const { data, error } = await admin
          .from('messages')
          .select('connection_id,content,image_url,storage_path,created_at')
          .eq('connection_id', cid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error || !data) return
        const r = data as LatestMsgRow
        out.set(cid, {
          preview: previewFromMessage(r),
          created_at: r.created_at ?? null,
        })
      })
    )
  }
  return out
}

export async function GET(request: Request) {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  const explicit = new URL(request.url).searchParams.get('subject_user_id')?.trim()
  const subject =
    explicit && UUID_RE.test(explicit)
      ? explicit.toLowerCase()
      : getSupportChatUserId()

  if (!subject) {
    return NextResponse.json(
      {
        error:
          'No subject user: pass subject_user_id query param or set SUPPORT_CHAT_USER_ID on the server',
      },
      { status: 400 }
    )
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service role key is not configured' }, { status: 500 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: rows, error } = await admin
    .from('connections')
    .select('id,user_id_1,user_id_2,status,created_at')
    .or(`user_id_1.eq.${subject},user_id_2.eq.${subject}`)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('support-chat connections:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const peerIds = new Set<string>()
  const normalizedSubject = subject
  for (const row of rows ?? []) {
    const r = row as { user_id_1?: string | null; user_id_2?: string | null }
    const u1 = r.user_id_1 ? String(r.user_id_1).toLowerCase() : ''
    const u2 = r.user_id_2 ? String(r.user_id_2).toLowerCase() : ''
    if (u1 === normalizedSubject && u2) peerIds.add(u2)
    else if (u2 === normalizedSubject && u1) peerIds.add(u1)
  }

  const profileByUserId = new Map<string, SupportChatPeerProfile>()
  for (const slice of chunkIds([...peerIds])) {
    if (slice.length === 0) continue
    const { data: profRows, error: pErr } = await admin
      .from('profiles')
      .select('user_id, name, username, profile_picture_url, gender')
      .in('user_id', slice)
    if (pErr) {
      console.error('support-chat connections profiles:', pErr)
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }
    for (const p of profRows ?? []) {
      const row = p as ActivityProfileMini & { gender?: string | null }
      const enriched: SupportChatPeerProfile = {
        user_id: row.user_id,
        name: row.name ?? null,
        username: row.username ?? null,
        profile_picture_url: row.profile_picture_url ?? null,
        gender: row.gender ?? null,
      }
      profileByUserId.set(String(row.user_id).toLowerCase(), enriched)
    }
  }

  const connectionsBase: Omit<SupportChatConnectionRow, 'last_message_at' | 'last_message_preview'>[] = (
    rows ?? []
  ).map((row) => {
    const r = row as {
      id: string
      user_id_1: string | null
      user_id_2: string | null
      status: string | null
      created_at: string | null
    }
    const u1 = r.user_id_1 ? String(r.user_id_1).toLowerCase() : ''
    const u2 = r.user_id_2 ? String(r.user_id_2).toLowerCase() : ''
    let peerUserId: string | null = null
    if (u1 === normalizedSubject) peerUserId = r.user_id_2 ? String(r.user_id_2) : null
    else if (u2 === normalizedSubject) peerUserId = r.user_id_1 ? String(r.user_id_1) : null

    const peerKey = peerUserId ? peerUserId.toLowerCase() : ''
    const peer = peerUserId ? profileByUserId.get(peerKey) ?? null : null

    return {
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      peer_user_id: peerUserId,
      peer,
    }
  })

  const ids = connectionsBase.map((c) => c.id)
  const latestMap = await fetchLatestMessageByConnectionIds(admin, ids)

  const connections: SupportChatConnectionRow[] = connectionsBase.map((c) => {
    const lm = latestMap.get(c.id)
    return {
      ...c,
      last_message_at: lm?.created_at ?? null,
      last_message_preview: lm?.preview ?? null,
    }
  })

  connections.sort((a, b) => {
    const ta = new Date(a.last_message_at || a.created_at || 0).getTime()
    const tb = new Date(b.last_message_at || b.created_at || 0).getTime()
    return tb - ta
  })

  return NextResponse.json({ connections, subject_user_id: subject })
}

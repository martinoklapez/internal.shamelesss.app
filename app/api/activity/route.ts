import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'
import { signedImageUrlsByMessageId } from '@/lib/signed-message-image-urls'
import type {
  ActivityConnectionRow,
  ActivityFriendRequestRow,
  ActivityMessageRow,
  ActivityProfileMini,
  ActivityProfileViewRow,
  ActivityUploadRow,
} from '@/lib/activity-feed-types'

export const dynamic = 'force-dynamic'

const USER_ID_CHUNK = 100

function chunkIds(ids: string[]): string[][] {
  const uniq = [...new Set(ids.map((id) => String(id)).filter(Boolean))]
  const out: string[][] = []
  for (let i = 0; i < uniq.length; i += USER_ID_CHUNK) {
    out.push(uniq.slice(i, i + USER_ID_CHUNK))
  }
  return out
}

const EXPLICIT_PHOTOS_BUCKET = 'explicit-photos'
const SIGNED_UPLOAD_TTL_SEC = 3600
const SIGNED_PATH_CHUNK = 50

/** Batch-sign paths in a single private bucket (used for explicit_photos thumbnails). */
async function signedUrlsInBucket(
  admin: any,
  bucket: string,
  paths: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = [...new Set(paths.map((p) => String(p).trim()).filter(Boolean))]
  for (let i = 0; i < unique.length; i += SIGNED_PATH_CHUNK) {
    const slice = unique.slice(i, i + SIGNED_PATH_CHUNK)
    const { data, error } = await admin.storage.from(bucket).createSignedUrls(slice, SIGNED_UPLOAD_TTL_SEC)
    if (error) {
      console.error('activity signedUrlsInBucket:', bucket, error.message)
      continue
    }
    type Row = { signedUrl?: string; error?: string }
    const rows = (data ?? []) as Row[]
    for (let j = 0; j < slice.length; j++) {
      const requestedPath = slice[j]
      const row = rows[j]
      const url = typeof row?.signedUrl === 'string' ? row.signedUrl.trim() : ''
      if (!url || row?.error) continue
      out.set(requestedPath, url)
    }
  }
  return out
}

function previewMessageContent(content: string | null | undefined, max = 140): string | null {
  if (content == null || typeof content !== 'string') return null
  const t = content.replace(/\s+/g, ' ').trim()
  if (!t) return null
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/** Match `friend_requests` for this user pair — prefer accepted, then newest by `updated_at`. */
async function friendRequestSourceForPair(
  admin: any,
  user_id_1: string | null,
  user_id_2: string | null
): Promise<string | null> {
  const a = user_id_1 ? String(user_id_1).trim() : ''
  const b = user_id_2 ? String(user_id_2).trim() : ''
  if (!a || !b) return null

  const newestSource = async (statusAcceptedOnly: boolean) => {
    const build = (from: string, to: string) => {
      let q = admin
        .from('friend_requests')
        .select('source,updated_at')
        .eq('from_user_id', from)
        .eq('to_user_id', to)
      if (statusAcceptedOnly) q = q.eq('status', 'accepted')
      return q.order('updated_at', { ascending: false }).limit(1)
    }
    const [{ data: d1 }, { data: d2 }] = await Promise.all([build(a, b), build(b, a)])
    type Row = { source: string | null; updated_at: string | null }
    const rows = [...((d1 as Row[]) || []), ...((d2 as Row[]) || [])]
    rows.sort((x, y) => {
      const tx = x.updated_at ? new Date(x.updated_at).getTime() : 0
      const ty = y.updated_at ? new Date(y.updated_at).getTime() : 0
      return ty - tx
    })
    const s = rows[0]?.source
    return typeof s === 'string' && s.trim() ? s.trim() : null
  }

  const fromAccepted = await newestSource(true)
  if (fromAccepted) return fromAccepted
  return newestSource(false)
}

const ACTIVITY_SECTIONS = [
  'connections',
  'friend_requests',
  'messages',
  'uploads',
  'profile_views',
] as const
type ActivitySection = (typeof ACTIVITY_SECTIONS)[number]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawSection = (searchParams.get('section') || 'connections').trim()
    const section: ActivitySection = ACTIVITY_SECTIONS.includes(rawSection as ActivitySection)
      ? (rawSection as ActivitySection)
      : 'connections'

    const rawPage = parseInt(searchParams.get('page') || '1', 10)
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1

    const rawPerPage = parseInt(searchParams.get('per_page') || searchParams.get('limit') || '25', 10)
    const perPage = Number.isFinite(rawPerPage) ? Math.min(100, Math.max(1, rawPerPage)) : 25

    const offset = (page - 1) * perPage
    const rangeEnd = offset + perPage - 1

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = await getUserRole(user.id)
    if (role !== 'admin' && role !== 'dev' && role !== 'developer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Service role key is not configured on the server' },
        { status: 500 }
      )
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const [
      connCountRes,
      frCountRes,
      msgCountRes,
      pvCountRes,
      uploadCountRes,
    ] = await Promise.all([
      admin.from('connections').select('id', { count: 'exact', head: true }),
      admin.from('friend_requests').select('id', { count: 'exact', head: true }),
      admin.from('messages').select('id', { count: 'exact', head: true }),
      admin.from('profile_views').select('id', { count: 'exact', head: true }),
      admin.from('explicit_photos').select('id', { count: 'exact', head: true }),
    ])

    if (connCountRes.error) {
      console.error('activity connections count:', connCountRes.error)
      return NextResponse.json(
        { error: `Failed to count connections: ${connCountRes.error.message}` },
        { status: 500 }
      )
    }
    if (frCountRes.error) {
      console.error('activity friend_requests count:', frCountRes.error)
      return NextResponse.json(
        { error: `Failed to count friend requests: ${frCountRes.error.message}` },
        { status: 500 }
      )
    }
    if (msgCountRes.error) {
      console.error('activity messages count:', msgCountRes.error)
      return NextResponse.json(
        { error: `Failed to count messages: ${msgCountRes.error.message}` },
        { status: 500 }
      )
    }
    if (pvCountRes.error) {
      console.error('activity profile_views count:', pvCountRes.error)
      return NextResponse.json(
        { error: `Failed to count profile views: ${pvCountRes.error.message}` },
        { status: 500 }
      )
    }
    if (uploadCountRes.error) {
      console.error('activity explicit_photos count:', uploadCountRes.error)
      return NextResponse.json(
        { error: `Failed to count uploads: ${uploadCountRes.error.message}` },
        { status: 500 }
      )
    }

    let connRes: { data: unknown[] | null; error: { message: string } | null }
    let frRes: { data: unknown[] | null; error: { message: string } | null }
    let msgRes: { data: unknown[] | null; error: { message: string } | null }
    let pvRes: { data: unknown[] | null; error: { message: string } | null }
    let uploadRes: { data: unknown[] | null; error: { message: string } | null }

    const empty = { data: [] as unknown[], error: null }

    switch (section) {
      case 'connections':
        connRes = await admin
          .from('connections')
          .select('id,user_id_1,user_id_2,status,created_at')
          .order('created_at', { ascending: false })
          .range(offset, rangeEnd)
        frRes = empty
        msgRes = empty
        pvRes = empty
        uploadRes = empty
        break
      case 'friend_requests':
        connRes = empty
        frRes = await admin.from('friend_requests').select('*').order('created_at', { ascending: false }).range(offset, rangeEnd)
        msgRes = empty
        pvRes = empty
        uploadRes = empty
        break
      case 'messages':
        connRes = empty
        frRes = empty
        msgRes = await admin
          .from('messages')
          .select('id,connection_id,sender_id,content,image_url,storage_path,storage_bucket,created_at')
          .order('created_at', { ascending: false })
          .range(offset, rangeEnd)
        pvRes = empty
        uploadRes = empty
        break
      case 'profile_views':
        connRes = empty
        frRes = empty
        msgRes = empty
        pvRes = await admin.from('profile_views').select('*').order('viewed_at', { ascending: false }).range(offset, rangeEnd)
        uploadRes = empty
        break
      case 'uploads':
        connRes = empty
        frRes = empty
        msgRes = empty
        pvRes = empty
        uploadRes = await admin
          .from('explicit_photos')
          .select('id,user_id,storage_path,file_size,content_type,is_revealed,revealed_at,created_at')
          .order('created_at', { ascending: false })
          .range(offset, rangeEnd)
        break
    }

    if (connRes.error) {
      console.error('activity connections:', connRes.error)
      return NextResponse.json(
        { error: `Failed to load connections: ${connRes.error.message}` },
        { status: 500 }
      )
    }
    if (frRes.error) {
      console.error('activity friend_requests:', frRes.error)
      return NextResponse.json(
        { error: `Failed to load friend requests: ${frRes.error.message}` },
        { status: 500 }
      )
    }
    if (msgRes.error) {
      console.error('activity messages:', msgRes.error)
      return NextResponse.json(
        { error: `Failed to load messages: ${msgRes.error.message}` },
        { status: 500 }
      )
    }
    if (pvRes.error) {
      console.error('activity profile_views:', pvRes.error)
      return NextResponse.json(
        { error: `Failed to load profile views: ${pvRes.error.message}` },
        { status: 500 }
      )
    }
    if (uploadRes.error) {
      console.error('activity explicit_photos:', uploadRes.error)
      return NextResponse.json(
        { error: `Failed to load uploads: ${uploadRes.error.message}` },
        { status: 500 }
      )
    }

    const connectionsRaw = connRes.data ?? []
    const friendRequestsRaw = frRes.data ?? []
    const messagesRaw = msgRes.data ?? []
    const profileViewsRaw = pvRes.data ?? []
    const explicitPhotosRaw = uploadRes.data ?? []

    /** How this chat connection likely started (from `friend_requests.source` between the pair). */
    const connectionFriendSources = await Promise.all(
      connectionsRaw.map(async (raw) => {
        const row = raw as {
          id: string
          user_id_1: string | null
          user_id_2: string | null
        }
        const src = await friendRequestSourceForPair(admin, row.user_id_1, row.user_id_2)
        return [row.id, src] as const
      })
    )
    const friendSourceByConnectionId = new Map<string, string | null>(connectionFriendSources)

    const connectionIdsFromMessages = [
      ...new Set(
        messagesRaw
          .map((m) => (m as { connection_id?: string | null }).connection_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ]

    let connectionsById = new Map<
      string,
      { user_id_1: string | null; user_id_2: string | null }
    >()
    if (connectionIdsFromMessages.length > 0) {
      const { data: convRows, error: convErr } = await admin
        .from('connections')
        .select('id,user_id_1,user_id_2')
        .in('id', connectionIdsFromMessages)

      if (convErr) {
        console.error('activity connections for messages:', convErr)
        return NextResponse.json(
          { error: `Failed to load connections for messages: ${convErr.message}` },
          { status: 500 }
        )
      }
      for (const row of convRows ?? []) {
        const r = row as { id: string; user_id_1: string | null; user_id_2: string | null }
        connectionsById.set(r.id, { user_id_1: r.user_id_1, user_id_2: r.user_id_2 })
      }
    }

    const userIdSet = new Set<string>()
    for (const c of connectionsRaw) {
      const r = c as {
        user_id_1?: string | null
        user_id_2?: string | null
      }
      if (r.user_id_1) userIdSet.add(String(r.user_id_1))
      if (r.user_id_2) userIdSet.add(String(r.user_id_2))
    }
    for (const fr of friendRequestsRaw) {
      const r = fr as { from_user_id: string; to_user_id: string }
      userIdSet.add(String(r.from_user_id))
      userIdSet.add(String(r.to_user_id))
    }
    for (const m of messagesRaw) {
      const r = m as { sender_id?: string | null; connection_id?: string | null }
      if (r.sender_id) userIdSet.add(String(r.sender_id))
      const conn = r.connection_id ? connectionsById.get(r.connection_id) : undefined
      if (conn?.user_id_1) userIdSet.add(String(conn.user_id_1))
      if (conn?.user_id_2) userIdSet.add(String(conn.user_id_2))
    }
    for (const pv of profileViewsRaw) {
      const r = pv as { viewer_id: string; viewed_user_id: string }
      userIdSet.add(String(r.viewer_id))
      userIdSet.add(String(r.viewed_user_id))
    }
    for (const ep of explicitPhotosRaw) {
      const r = ep as { user_id?: string | null }
      if (r.user_id) userIdSet.add(String(r.user_id))
    }

    const profileByUserId = new Map<string, ActivityProfileMini>()
    const allIds = [...userIdSet]
    for (const slice of chunkIds(allIds)) {
      if (slice.length === 0) continue
      const { data: profRows, error: pErr } = await admin
        .from('profiles')
        .select('user_id, name, username, profile_picture_url')
        .in('user_id', slice)

      if (pErr) {
        console.error('activity profiles chunk:', pErr)
        return NextResponse.json(
          { error: `Failed to load profiles: ${pErr.message}` },
          { status: 500 }
        )
      }
      for (const p of profRows ?? []) {
        const row = p as ActivityProfileMini
        profileByUserId.set(row.user_id, row)
      }
    }

    const explicitPaths = explicitPhotosRaw
      .map((ep) => {
        const p = ep as { storage_path?: string | null }
        return typeof p.storage_path === 'string' ? p.storage_path.trim() : ''
      })
      .filter(Boolean)
    const signedExplicitByPath = await signedUrlsInBucket(
      admin,
      EXPLICIT_PHOTOS_BUCKET,
      explicitPaths
    )

    const signedMessageImageById =
      messagesRaw.length > 0
        ? await signedImageUrlsByMessageId(admin, messagesRaw as Record<string, unknown>[])
        : new Map<string, string>()

    const connections: ActivityConnectionRow[] = connectionsRaw.map((row) => {
      const r = row as {
        id: string
        user_id_1: string | null
        user_id_2: string | null
        status: string | null
        created_at: string | null
      }
      const u1 = r.user_id_1 ? profileByUserId.get(r.user_id_1) ?? null : null
      const u2 = r.user_id_2 ? profileByUserId.get(r.user_id_2) ?? null : null
      return {
        id: r.id,
        user_id_1: r.user_id_1,
        user_id_2: r.user_id_2,
        status: r.status,
        created_at: r.created_at,
        user_1: u1,
        user_2: u2,
        friend_request_source: friendSourceByConnectionId.get(r.id) ?? null,
      }
    })

    const friend_requests: ActivityFriendRequestRow[] = friendRequestsRaw.map((row) => {
      const r = row as {
        id: string
        from_user_id: string
        to_user_id: string
        status: string
        message: string | null
        created_at: string | null
        updated_at: string | null
        source: string | null
      }
      return {
        id: r.id,
        from_user_id: r.from_user_id,
        to_user_id: r.to_user_id,
        status: r.status,
        message: r.message,
        created_at: r.created_at,
        updated_at: r.updated_at,
        source: r.source,
        from_user: profileByUserId.get(r.from_user_id) ?? null,
        to_user: profileByUserId.get(r.to_user_id) ?? null,
      }
    })

    const messages: ActivityMessageRow[] = messagesRaw.map((row) => {
      const r = row as {
        id: string
        connection_id: string | null
        sender_id: string | null
        content: string | null
        image_url: string | null
        storage_path: string | null
        created_at: string | null
      }
      const conn = r.connection_id ? connectionsById.get(r.connection_id) : undefined
      let otherUserId: string | null = null
      if (conn && r.sender_id) {
        const s = String(r.sender_id)
        if (conn.user_id_1 && String(conn.user_id_1) !== s) otherUserId = String(conn.user_id_1)
        else if (conn.user_id_2 && String(conn.user_id_2) !== s) otherUserId = String(conn.user_id_2)
      }
      const hasImage = Boolean(
        (r.image_url && r.image_url.trim()) || (r.storage_path && r.storage_path.trim())
      )
      const signedUrl = signedMessageImageById.get(r.id) ?? null
      const legacyUrl = typeof r.image_url === 'string' ? r.image_url.trim() : ''
      const publicHttpUrl = legacyUrl && /^https?:\/\//i.test(legacyUrl) ? legacyUrl : null
      return {
        id: r.id,
        connection_id: r.connection_id,
        sender_id: r.sender_id,
        content_preview: previewMessageContent(r.content),
        has_image: hasImage,
        image_url: publicHttpUrl,
        signed_image_url: signedUrl,
        created_at: r.created_at,
        sender: r.sender_id ? profileByUserId.get(String(r.sender_id)) ?? null : null,
        other_user: otherUserId ? profileByUserId.get(otherUserId) ?? null : null,
      }
    })

    const profile_views: ActivityProfileViewRow[] = profileViewsRaw.map((row) => {
      const r = row as { id: string; viewer_id: string; viewed_user_id: string; viewed_at: string }
      return {
        id: r.id,
        viewer_id: r.viewer_id,
        viewed_user_id: r.viewed_user_id,
        viewed_at: r.viewed_at,
        viewer: profileByUserId.get(r.viewer_id) ?? null,
        viewed_user: profileByUserId.get(r.viewed_user_id) ?? null,
      }
    })

    const uploads: ActivityUploadRow[] = explicitPhotosRaw.map((row) => {
      const r = row as {
        id: string
        user_id: string
        storage_path: string
        file_size: number | null
        content_type: string | null
        is_revealed: boolean | null
        revealed_at: string | null
        created_at: string | null
      }
      const path = typeof r.storage_path === 'string' ? r.storage_path.trim() : ''
      return {
        id: r.id,
        user_id: r.user_id,
        storage_path: path,
        file_size: r.file_size ?? null,
        content_type: r.content_type ?? null,
        is_revealed: r.is_revealed ?? null,
        revealed_at: r.revealed_at ?? null,
        created_at: r.created_at,
        user: profileByUserId.get(String(r.user_id)) ?? null,
        signed_image_url: path ? signedExplicitByPath.get(path) ?? null : null,
      }
    })

    return NextResponse.json({
      section,
      page,
      per_page: perPage,
      totals: {
        connections: connCountRes.count ?? 0,
        friend_requests: frCountRes.count ?? 0,
        messages: msgCountRes.count ?? 0,
        profile_views: pvCountRes.count ?? 0,
        uploads: uploadCountRes.count ?? 0,
      },
      connections,
      friend_requests,
      messages,
      uploads,
      profile_views,
    })
  } catch (e) {
    console.error('activity route:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

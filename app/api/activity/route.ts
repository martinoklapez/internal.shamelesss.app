import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'
import { signedImageUrlsByMessageId } from '@/lib/signed-message-image-urls'
import type {
  ActivityConnectionRow,
  ActivityDiaryMemoryImageRow,
  ActivityFriendRequestRow,
  ActivityMessageRow,
  ActivityPositionDiaryRow,
  ActivityProfileMini,
  ActivityProfileViewRow,
  ActivityUploadRow,
} from '@/lib/activity-feed-types'
import {
  ACTIVITY_HIDDEN_USER_IDS,
  hasActivityHiddenUsers,
} from '@/lib/activity-hidden-users'

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

async function fetchConnectionIdsTouchingHiddenUsers(admin: any): Promise<string[]> {
  if (!hasActivityHiddenUsers()) return []
  const orParts = ACTIVITY_HIDDEN_USER_IDS.flatMap((h) => [`user_id_1.eq.${h}`, `user_id_2.eq.${h}`])
  const { data, error } = await admin.from('connections').select('id').or(orParts.join(',')).limit(50000)
  if (error) {
    console.error('activity hidden-touch connections:', error)
    return []
  }
  const rows = (data ?? []) as { id: string }[]
  return [...new Set(rows.map((r) => String(r.id)))]
}

type FilterableQuery = any

function filterConnectionsHidden(q: FilterableQuery): FilterableQuery {
  let x = q
  for (const h of ACTIVITY_HIDDEN_USER_IDS) {
    x = x.neq('user_id_1', h).neq('user_id_2', h)
  }
  return x
}

function filterFriendRequestsHidden(q: FilterableQuery): FilterableQuery {
  let x = q
  for (const h of ACTIVITY_HIDDEN_USER_IDS) {
    x = x.neq('from_user_id', h).neq('to_user_id', h)
  }
  return x
}

function filterProfileViewsHidden(q: FilterableQuery): FilterableQuery {
  let x = q
  for (const h of ACTIVITY_HIDDEN_USER_IDS) {
    x = x.neq('viewer_id', h).neq('viewed_user_id', h)
  }
  return x
}

function filterExplicitPhotosHidden(q: FilterableQuery): FilterableQuery {
  let x = q
  for (const h of ACTIVITY_HIDDEN_USER_IDS) {
    x = x.neq('user_id', h)
  }
  return x
}

function filterPositionDiaryHidden(q: FilterableQuery): FilterableQuery {
  let x = q
  for (const h of ACTIVITY_HIDDEN_USER_IDS) {
    x = x.neq('user_id', h)
  }
  return x
}

function filterDiaryMemoryImagesHidden(q: FilterableQuery): FilterableQuery {
  let x = q
  for (const h of ACTIVITY_HIDDEN_USER_IDS) {
    x = x.neq('user_id', h)
  }
  return x
}

function filterMessagesHidden(q: FilterableQuery, excludedConnectionIds: string[]): FilterableQuery {
  let x = q
  for (const h of ACTIVITY_HIDDEN_USER_IDS) {
    x = x.neq('sender_id', h)
  }
  if (excludedConnectionIds.length > 0) {
    x = x.not('connection_id', 'in', `(${excludedConnectionIds.join(',')})`)
  }
  return x
}

const EXPLICIT_PHOTOS_BUCKET = 'explicit-photos'
/**
 * Private bucket for diary memory uploads (`diary_memory_images.memory_image_path`).
 * Matches mobile/web MemoriesService — paths look like `{userId}/{filename}.jpg`.
 */
const MEMORIES_BUCKET = 'memories'
/** Buckets tried when resolving diary memory paths (includes legacy names). */
const DIARY_MEMORY_SIGN_BUCKETS = [
  MEMORIES_BUCKET,
  'diary-memory-images',
  EXPLICIT_PHOTOS_BUCKET,
  'chat-images',
  'poses',
  'date-roulette-poses',
  'profiles',
] as const

const KNOWN_BUCKET_PREFIXES = new Set<string>(DIARY_MEMORY_SIGN_BUCKETS)
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

/** Paths saved without leading slashes (matches Supabase object keys). */
function normalizeDiaryMemoryStoragePath(raw: string): string {
  return String(raw).trim().replace(/^\/+/, '')
}

/** Extract bucket + object key from Supabase render URLs (sign when bucket is private). */
function parseSupabaseStorageObjectUrl(rawUrl: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(rawUrl.trim())
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/)
    if (!m) return null
    const bucket = decodeURIComponent(m[1])
    const path = decodeURIComponent(m[2])
    if (!bucket || !path) return null
    return { bucket, path }
  } catch {
    return null
  }
}

function diaryMemoryPathVariants(norm: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (s: string) => {
    const t = normalizeDiaryMemoryStoragePath(s)
    if (!t || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }
  push(norm)
  try {
    if (norm.includes('%')) push(decodeURIComponent(norm))
  } catch {
    /* ignore */
  }
  return out
}

/**
 * Map each DB `memory_image_path` string to a browser-loadable URL.
 * Supports Supabase HTTPS URLs (re-signed), `bucket/path` prefixes, and ambiguous paths via fallback buckets.
 */
async function resolveDiaryMemoryImageUrlMap(admin: any, rawPaths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const uniqueRaw = [...new Set(rawPaths.map((p) => String(p).trim()).filter(Boolean))]

  /** bucket → object path → DB raw strings that should receive the resolved URL */
  const explicitByBucket = new Map<string, Map<string, string[]>>()
  function queueExplicit(bucket: string, objectPath: string, raw: string) {
    const norm = normalizeDiaryMemoryStoragePath(objectPath)
    if (!norm) return
    let pathMap = explicitByBucket.get(bucket)
    if (!pathMap) {
      pathMap = new Map()
      explicitByBucket.set(bucket, pathMap)
    }
    const arr = pathMap.get(norm) ?? []
    arr.push(raw)
    pathMap.set(norm, arr)
  }

  const ambiguousNormToRaws = new Map<string, string[]>()
  function queueAmbiguous(norm: string, raw: string) {
    const arr = ambiguousNormToRaws.get(norm) ?? []
    arr.push(raw)
    ambiguousNormToRaws.set(norm, arr)
  }

  for (const raw of uniqueRaw) {
    const t = raw.trim()

    if (/^https?:\/\//i.test(t)) {
      const loc = parseSupabaseStorageObjectUrl(t)
      if (loc) {
        queueExplicit(loc.bucket, loc.path, raw)
        continue
      }
      out.set(raw, raw)
      continue
    }

    const norm = normalizeDiaryMemoryStoragePath(t)
    if (!norm) continue

    const slash = norm.indexOf('/')
    if (slash > 0) {
      const maybeBucket = norm.slice(0, slash)
      const rest = norm.slice(slash + 1)
      if (KNOWN_BUCKET_PREFIXES.has(maybeBucket) && rest) {
        queueExplicit(maybeBucket, rest, raw)
        continue
      }
    }

    queueAmbiguous(norm, raw)
  }

  for (const [bucket, pathMap] of explicitByBucket) {
    const paths = [...pathMap.keys()]
    if (paths.length === 0) continue
    const signed = await signedUrlsInBucket(admin, bucket, paths)
    for (const path of paths) {
      const url = signed.get(path)
      if (!url) continue
      for (const r of pathMap.get(path) ?? []) out.set(r, url)
    }
  }

  let pendingNorms = [...ambiguousNormToRaws.keys()].filter((norm) =>
    (ambiguousNormToRaws.get(norm) ?? []).some((raw) => !out.has(raw))
  )

  for (const bucket of DIARY_MEMORY_SIGN_BUCKETS) {
    if (pendingNorms.length === 0) break

    const pathToNorm = new Map<string, string>()
    const batchPaths: string[] = []
    for (const norm of pendingNorms) {
      if ((ambiguousNormToRaws.get(norm) ?? []).every((raw) => out.has(raw))) continue
      for (const variant of diaryMemoryPathVariants(norm)) {
        if (!pathToNorm.has(variant)) {
          pathToNorm.set(variant, norm)
          batchPaths.push(variant)
        }
      }
    }
    if (batchPaths.length === 0) continue

    const signed = await signedUrlsInBucket(admin, bucket, batchPaths)
    const still = new Set(pendingNorms)
    for (const [requestedPath, url] of signed) {
      if (!url) continue
      const norm = pathToNorm.get(requestedPath)
      if (!norm) continue
      for (const raw of ambiguousNormToRaws.get(norm) ?? []) out.set(raw, url)
      still.delete(norm)
    }
    pendingNorms = [...still].filter((norm) =>
      (ambiguousNormToRaws.get(norm) ?? []).some((raw) => !out.has(raw))
    )
  }

  return out
}

function diaryMemoryResolvedUrl(map: Map<string, string>, rawPath: string): string | null {
  const t = String(rawPath).trim()
  if (!t) return null
  const norm = normalizeDiaryMemoryStoragePath(t)
  const candidates = [t, norm, ...diaryMemoryPathVariants(norm)].filter(Boolean)
  const uniq = [...new Set(candidates)]
  for (const k of uniq) {
    const hit = map.get(k)
    if (hit) return hit
  }
  return null
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
  'diary',
  'profile_views',
] as const
type ActivitySection = (typeof ACTIVITY_SECTIONS)[number]

const LEGACY_ACTIVITY_SECTION_ALIASES: Record<string, ActivitySection> = {
  position_diary: 'diary',
  diary_memory_images: 'diary',
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawSection = (searchParams.get('section') || 'connections').trim()
    const resolvedRaw = LEGACY_ACTIVITY_SECTION_ALIASES[rawSection] ?? rawSection
    const section: ActivitySection = ACTIVITY_SECTIONS.includes(resolvedRaw as ActivitySection)
      ? (resolvedRaw as ActivitySection)
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

    const excludedConnIdsHiddenUsers = await fetchConnectionIdsTouchingHiddenUsers(admin)

    const [
      connCountRes,
      frCountRes,
      msgCountRes,
      pvCountRes,
      uploadCountRes,
      diaryCountRes,
      memoryImgCountRes,
    ] = await Promise.all([
      filterConnectionsHidden(admin.from('connections').select('id', { count: 'exact', head: true })),
      filterFriendRequestsHidden(admin.from('friend_requests').select('id', { count: 'exact', head: true })),
      filterMessagesHidden(
        admin.from('messages').select('id', { count: 'exact', head: true }),
        excludedConnIdsHiddenUsers
      ),
      filterProfileViewsHidden(admin.from('profile_views').select('id', { count: 'exact', head: true })),
      filterExplicitPhotosHidden(admin.from('explicit_photos').select('id', { count: 'exact', head: true })),
      filterPositionDiaryHidden(admin.from('position_diary').select('id', { count: 'exact', head: true })),
      filterDiaryMemoryImagesHidden(
        admin.from('diary_memory_images').select('id', { count: 'exact', head: true })
      ),
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
    if (diaryCountRes.error) {
      console.error('activity position_diary count:', diaryCountRes.error)
      return NextResponse.json(
        { error: `Failed to count position diary: ${diaryCountRes.error.message}` },
        { status: 500 }
      )
    }
    if (memoryImgCountRes.error) {
      console.error('activity diary_memory_images count:', memoryImgCountRes.error)
      return NextResponse.json(
        { error: `Failed to count diary memory images: ${memoryImgCountRes.error.message}` },
        { status: 500 }
      )
    }

    let connRes: { data: unknown[] | null; error: { message: string } | null }
    let frRes: { data: unknown[] | null; error: { message: string } | null }
    let msgRes: { data: unknown[] | null; error: { message: string } | null }
    let pvRes: { data: unknown[] | null; error: { message: string } | null }
    let uploadRes: { data: unknown[] | null; error: { message: string } | null }

    const empty = { data: [] as unknown[], error: null as { message: string } | null }
    let diaryRes = empty
    let memoryImgRes = empty

    switch (section) {
      case 'connections':
        connRes = await filterConnectionsHidden(
          admin.from('connections').select('id,user_id_1,user_id_2,status,created_at')
        )
          .order('created_at', { ascending: false })
          .range(offset, rangeEnd)
        frRes = empty
        msgRes = empty
        pvRes = empty
        uploadRes = empty
        break
      case 'friend_requests':
        connRes = empty
        frRes = await filterFriendRequestsHidden(admin.from('friend_requests').select('*'))
          .order('created_at', { ascending: false })
          .range(offset, rangeEnd)
        msgRes = empty
        pvRes = empty
        uploadRes = empty
        break
      case 'messages':
        connRes = empty
        frRes = empty
        msgRes = await filterMessagesHidden(
          admin
            .from('messages')
            .select(
              'id,connection_id,sender_id,content,image_url,storage_path,storage_bucket,created_at'
            ),
          excludedConnIdsHiddenUsers
        )
          .order('created_at', { ascending: false })
          .range(offset, rangeEnd)
        pvRes = empty
        uploadRes = empty
        break
      case 'profile_views':
        connRes = empty
        frRes = empty
        msgRes = empty
        pvRes = await filterProfileViewsHidden(admin.from('profile_views').select('*'))
          .order('viewed_at', { ascending: false })
          .range(offset, rangeEnd)
        uploadRes = empty
        break
      case 'uploads':
        connRes = empty
        frRes = empty
        msgRes = empty
        pvRes = empty
        uploadRes = await filterExplicitPhotosHidden(
          admin
            .from('explicit_photos')
            .select(
              'id,user_id,storage_path,file_size,content_type,is_revealed,revealed_at,created_at'
            )
        )
          .order('created_at', { ascending: false })
          .range(offset, rangeEnd)
        break
      case 'diary':
        connRes = empty
        frRes = empty
        msgRes = empty
        pvRes = empty
        uploadRes = empty
        ;[diaryRes, memoryImgRes] = await Promise.all([
          filterPositionDiaryHidden(
            admin
              .from('position_diary')
              .select(
                'id,user_id,position_id,rating,feeling_for_her,feeling_for_him,notes,worth_repeat,memory_image_path,created_at,updated_at'
              )
          )
            .order('created_at', { ascending: false })
            .range(offset, rangeEnd),
          filterDiaryMemoryImagesHidden(
            admin
              .from('diary_memory_images')
              .select('id,diary_entry_id,user_id,memory_image_path,created_at,is_visible')
          )
            .order('created_at', { ascending: false })
            .range(offset, rangeEnd),
        ])
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
    if (diaryRes.error) {
      console.error('activity position_diary:', diaryRes.error)
      return NextResponse.json(
        { error: `Failed to load position diary: ${diaryRes.error.message}` },
        { status: 500 }
      )
    }
    if (memoryImgRes.error) {
      console.error('activity diary_memory_images:', memoryImgRes.error)
      return NextResponse.json(
        { error: `Failed to load diary memory images: ${memoryImgRes.error.message}` },
        { status: 500 }
      )
    }

    const connectionsRaw = connRes.data ?? []
    const friendRequestsRaw = frRes.data ?? []
    const messagesRaw = msgRes.data ?? []
    const profileViewsRaw = pvRes.data ?? []
    const explicitPhotosRaw = uploadRes.data ?? []
    const positionDiaryRaw = diaryRes.data ?? []
    const diaryMemoryImagesRaw = memoryImgRes.data ?? []

    const diaryMemoryEntryIds = [
      ...new Set(
        diaryMemoryImagesRaw
          .map((row) =>
            String((row as { diary_entry_id?: string | null }).diary_entry_id || '').trim()
          )
          .filter(Boolean)
      ),
    ]
    const diaryPositionByEntryId = new Map<string, string>()
    if (diaryMemoryEntryIds.length > 0) {
      const { data: diaryMetaRows, error: diaryMetaErr } = await admin
        .from('position_diary')
        .select('id,position_id')
        .in('id', diaryMemoryEntryIds)

      if (diaryMetaErr) {
        console.error('activity position_diary for diary_memory_images:', diaryMetaErr)
        return NextResponse.json(
          { error: `Failed to load diary entry positions: ${diaryMetaErr.message}` },
          { status: 500 }
        )
      }
      for (const row of diaryMetaRows ?? []) {
        const r = row as { id: string; position_id: string }
        diaryPositionByEntryId.set(String(r.id), String(r.position_id))
      }
    }

    const catalogImageByPositionId = new Map<string, string>()
    /** Latest memory-image storage path per diary entry id (for row thumbnails when legacy column is empty). */
    const galleryPathByDiaryEntryId = new Map<string, string>()
    if (positionDiaryRaw.length > 0) {
      const uniquePositionIds = [
        ...new Set(
          positionDiaryRaw
            .map((row) =>
              String((row as { position_id?: string | null }).position_id || '').trim()
            )
            .filter(Boolean)
        ),
      ]
      for (const slice of chunkIds(uniquePositionIds)) {
        if (slice.length === 0) continue
        const [{ data: scratchRows, error: posCatErr }, { data: drRows, error: drCatErr }] =
          await Promise.all([
            admin.from('positions').select('id,image_url').in('id', slice),
            admin.from('date_roulette_positions').select('id,image_url').in('id', slice),
          ])
        if (posCatErr) console.error('activity positions catalog:', posCatErr)
        if (drCatErr) console.error('activity date_roulette_positions catalog:', drCatErr)
        for (const row of [...(scratchRows ?? []), ...(drRows ?? [])]) {
          const r = row as { id: string; image_url: string | null }
          const url = typeof r.image_url === 'string' ? r.image_url.trim() : ''
          if (url) catalogImageByPositionId.set(String(r.id), url)
        }
      }

      const diaryRowIdsOnPage = [
        ...new Set(
          positionDiaryRaw
            .map((row) => String((row as { id?: string | null }).id || '').trim())
            .filter(Boolean)
        ),
      ]
      for (const slice of chunkIds(diaryRowIdsOnPage)) {
        if (slice.length === 0) continue
        const { data: coverRows, error: coverErr } = await filterDiaryMemoryImagesHidden(
          admin
            .from('diary_memory_images')
            .select('diary_entry_id,memory_image_path,created_at')
        )
          .in('diary_entry_id', slice)
          .order('created_at', { ascending: false })

        if (coverErr) {
          console.error('activity diary_memory_images entry thumbnails:', coverErr)
          return NextResponse.json(
            { error: `Failed to load diary memory thumbnails: ${coverErr.message}` },
            { status: 500 }
          )
        }
        for (const raw of coverRows ?? []) {
          const r = raw as { diary_entry_id: string; memory_image_path: string }
          const eid = String(r.diary_entry_id || '').trim()
          const p = String(r.memory_image_path || '').trim()
          if (!eid || !p || galleryPathByDiaryEntryId.has(eid)) continue
          galleryPathByDiaryEntryId.set(eid, p)
        }
      }
    }

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
    for (const pd of positionDiaryRaw) {
      const r = pd as { user_id?: string | null }
      if (r.user_id) userIdSet.add(String(r.user_id))
    }
    for (const dm of diaryMemoryImagesRaw) {
      const r = dm as { user_id?: string | null }
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

    const diaryMemoryPaths = [
      ...positionDiaryRaw.map((row) => {
        const p = row as { memory_image_path?: string | null }
        return typeof p.memory_image_path === 'string' ? p.memory_image_path.trim() : ''
      }),
      ...diaryMemoryImagesRaw.map((row) => {
        const p = row as { memory_image_path?: string | null }
        return typeof p.memory_image_path === 'string' ? p.memory_image_path.trim() : ''
      }),
      ...galleryPathByDiaryEntryId.values(),
    ].filter(Boolean)
    const diaryMemoryUrlByRaw =
      diaryMemoryPaths.length > 0 ? await resolveDiaryMemoryImageUrlMap(admin, diaryMemoryPaths) : new Map<string, string>()

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
        connection_user_id_1: conn?.user_id_1 ?? null,
        connection_user_id_2: conn?.user_id_2 ?? null,
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

    const position_diary: ActivityPositionDiaryRow[] = positionDiaryRaw.map((row) => {
      const r = row as {
        id: string
        user_id: string
        position_id: string
        rating: number | null
        feeling_for_her: string | null
        feeling_for_him: string | null
        notes: string | null
        worth_repeat: boolean | null
        memory_image_path: string | null
        created_at: string | null
        updated_at: string | null
      }
      const path =
        typeof r.memory_image_path === 'string' ? r.memory_image_path.trim() : ''
      const galleryPath = galleryPathByDiaryEntryId.get(String(r.id)) ?? ''
      const catalogUrl =
        catalogImageByPositionId.get(String(r.position_id || '').trim()) ?? null
      return {
        id: r.id,
        user_id: r.user_id,
        position_id: r.position_id,
        rating: r.rating ?? null,
        feeling_for_her: r.feeling_for_her ?? null,
        feeling_for_him: r.feeling_for_him ?? null,
        notes: r.notes ?? null,
        worth_repeat: r.worth_repeat ?? null,
        memory_image_path: path || null,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null,
        user: profileByUserId.get(String(r.user_id)) ?? null,
        signed_memory_image_url: path ? diaryMemoryResolvedUrl(diaryMemoryUrlByRaw, path) ?? null : null,
        entry_memory_preview_url: galleryPath
          ? diaryMemoryResolvedUrl(diaryMemoryUrlByRaw, galleryPath) ?? null
          : null,
        position_image_url: catalogUrl,
      }
    })

    const diary_memory_images: ActivityDiaryMemoryImageRow[] = diaryMemoryImagesRaw.map((row) => {
      const r = row as {
        id: string
        diary_entry_id: string
        user_id: string
        memory_image_path: string
        created_at: string | null
        is_visible: boolean | null
      }
      const path =
        typeof r.memory_image_path === 'string' ? r.memory_image_path.trim() : ''
      const entryId = String(r.diary_entry_id || '').trim()
      return {
        id: r.id,
        diary_entry_id: entryId,
        user_id: r.user_id,
        memory_image_path: path,
        created_at: r.created_at ?? null,
        is_visible: Boolean(r.is_visible),
        position_id: entryId ? diaryPositionByEntryId.get(entryId) ?? null : null,
        user: profileByUserId.get(String(r.user_id)) ?? null,
        signed_image_url: path ? diaryMemoryResolvedUrl(diaryMemoryUrlByRaw, path) ?? null : null,
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
        uploads: uploadCountRes.count ?? 0,
        position_diary: diaryCountRes.count ?? 0,
        diary_memory_images: memoryImgCountRes.count ?? 0,
        profile_views: pvCountRes.count ?? 0,
      },
      connections,
      friend_requests,
      messages,
      uploads,
      position_diary,
      diary_memory_images,
      profile_views,
    })
  } catch (e) {
    console.error('activity route:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

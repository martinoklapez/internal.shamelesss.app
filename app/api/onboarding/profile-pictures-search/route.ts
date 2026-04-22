import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserRole } from '@/lib/user-roles'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Service role key is not configured')
  }
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Escape % and _ for PostgREST ilike patterns. */
function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export type ProfilePictureSearchRow = {
  user_id: string
  name: string | null
  username: string | null
  profile_picture_url: string | null
  updated_at?: string | null
}

function isHttpAvatarUrl(url: string | null | undefined): boolean {
  const u = (url || '').trim()
  return /^https?:\/\//i.test(u)
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = await getUserRole(user.id)
    const allowedRoles = ['admin', 'dev', 'developer']
    if (!userRole || !allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const qRaw = (searchParams.get('q') || '').trim()
    const requestedLimit = parseInt(searchParams.get('limit') || (qRaw.length ? '60' : '500'), 10) || 36
    // Browsing all avatars (no text search): allow larger pages so admin grids can load most tenants in one round trip.
    // With search: two queries are merged in memory — keep a lower cap.
    const maxPerRequest = qRaw.length > 0 ? 120 : 500
    const limit = Math.min(maxPerRequest, Math.max(1, requestedLimit))
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0)

    const admin = getAdminClient()
    const selectCols = 'user_id, name, username, profile_picture_url, updated_at'

    const base = (withCount: boolean) => {
      const q = admin.from('profiles')
      return (
        withCount ? q.select(selectCols, { count: 'exact' }) : q.select(selectCols)
      ).like('profile_picture_url', 'http%')
    }

    let merged: ProfilePictureSearchRow[] = []

    if (qRaw.length === 0) {
      const { data, error, count } = await base(true)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('profile-pictures-search:', error)
        return NextResponse.json({ error: `Failed to load profiles: ${error.message}` }, { status: 500 })
      }

      merged = (data || []) as ProfilePictureSearchRow[]
      const profiles = merged.filter((r) => isHttpAvatarUrl(r.profile_picture_url))
      return NextResponse.json(
        { profiles, total: count ?? profiles.length, offset, limit },
        { status: 200 }
      )
    }

    const pattern = `%${escapeIlikePattern(qRaw)}%`

    const [byUsername, byName] = await Promise.all([
      base(false).ilike('username', pattern).order('updated_at', { ascending: false }).limit(limit + offset),
      base(false).ilike('name', pattern).order('updated_at', { ascending: false }).limit(limit + offset),
    ])

    if (byUsername.error) {
      console.error('profile-pictures-search username:', byUsername.error)
      return NextResponse.json(
        { error: `Failed to search profiles: ${byUsername.error.message}` },
        { status: 500 }
      )
    }
    if (byName.error) {
      console.error('profile-pictures-search name:', byName.error)
      return NextResponse.json(
        { error: `Failed to search profiles: ${byName.error.message}` },
        { status: 500 }
      )
    }

    const map = new Map<string, ProfilePictureSearchRow>()
    for (const row of [...(byUsername.data || []), ...(byName.data || [])]) {
      const r = row as ProfilePictureSearchRow
      if (!isHttpAvatarUrl(r.profile_picture_url)) continue
      if (!map.has(r.user_id)) map.set(r.user_id, r)
    }

    merged = [...map.values()].sort((a, b) => {
      const ta = new Date(a.updated_at || 0).getTime()
      const tb = new Date(b.updated_at || 0).getTime()
      return tb - ta
    })

    const total = merged.length
    merged = merged.slice(offset, offset + limit)

    return NextResponse.json({ profiles: merged, total, offset, limit }, { status: 200 })
  } catch (e: unknown) {
    console.error('profile-pictures-search:', e)
    const message = e instanceof Error ? e.message : 'Internal server error'
    if (message.includes('Service role key')) {
      return NextResponse.json({ error: message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

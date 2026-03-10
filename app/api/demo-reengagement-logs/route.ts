import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'

const LIMIT = 80

/** GET: fetch recent rows from re-engagement log tables. Admin/developer only. Uses service role to bypass RLS on log tables. */
export async function GET() {
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

  const out: {
    absolute_runs: unknown[]
    completed: unknown[]
    last_run: unknown[]
    scheduled_requests: unknown[]
    campaigns: { id: string; name: string }[]
  } = {
    absolute_runs: [],
    completed: [],
    last_run: [],
    scheduled_requests: [],
    campaigns: [],
  }

  const client =
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL
      ? createServiceRoleClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        )
      : supabase

  const [{ data: campaigns }] = await Promise.all([
    client.from('demo_reengagement_campaigns').select('id, name'),
  ])
  out.campaigns = (campaigns ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }))

  const [
    { data: absoluteRuns },
    { data: completed },
    { data: lastRun },
    { data: scheduledRequests },
  ] = await Promise.all([
    client
      .from('demo_reengagement_absolute_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LIMIT),
    client
      .from('demo_reengagement_completed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LIMIT),
    client
      .from('demo_reengagement_last_run')
      .select('*')
      .order('last_run_at', { ascending: false })
      .limit(LIMIT),
    client
      .from('scheduled_demo_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LIMIT),
  ])

  out.absolute_runs = absoluteRuns ?? []
  out.completed = completed ?? []
  out.last_run = lastRun ?? []
  out.scheduled_requests = scheduledRequests ?? []

  return NextResponse.json(out)
}

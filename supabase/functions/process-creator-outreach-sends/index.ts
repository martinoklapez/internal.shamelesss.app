// @ts-nocheck — Deno deploy target
/**
 * Supabase Edge Function: send queued creator outreach emails via Missive.
 *
 * Before deploy: npm run bundle:outreach-sends-edge
 * Secrets: MISSIVE_API_TOKEN, MISSIVE_TEAM_ID, MISSIVE_ORGANIZATION_ID (optional)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  processQueuedOutreachSends,
  readRuntimeEnv,
} from '../_shared/outreach-sends-worker.bundle.mjs'
import { isCronAuthorized } from '../_shared/cron-auth.ts'

function edgeBatchLimit(body: { limit?: number } | null): number {
  const envRaw = readRuntimeEnv('OUTREACH_SEND_EDGE_BATCH_SIZE')
  const envN = envRaw ? Number(envRaw) : 5
  const envDefault =
    Number.isFinite(envN) && envN > 0 ? Math.min(Math.floor(envN), 20) : 5

  if (body?.limit !== undefined && Number.isFinite(body.limit)) {
    return Math.min(Math.max(1, Math.floor(body.limit)), 20)
  }
  return envDefault
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!isCronAuthorized(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body: { limit?: number } | null = null
  try {
    body = (await req.json()) as { limit?: number }
  } catch {
    body = null
  }

  const limit = edgeBatchLimit(body)
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const result = await processQueuedOutreachSends(supabase, { limit })
    return new Response(JSON.stringify({ ...result, worker: 'edge' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed'
    console.error('process-creator-outreach-sends:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

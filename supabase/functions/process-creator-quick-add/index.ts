// @ts-nocheck — Deno deploy target; not typechecked by Next.js tsc
/**
 * Supabase Edge Function: drain creator_pipeline.quick_add_jobs (Apify scrape + plan).
 *
 * Before deploy: npm run bundle:quick-add-edge
 * Or: npm run deploy:quick-add-edge
 *
 * Secrets: APIFY_API_TOKEN, CREATOR_OUTREACH_CRON_SECRET (optional)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  processPendingQuickAddJobs,
  readRuntimeEnv,
} from '../_shared/quick-add-worker.bundle.mjs'
import { isCronAuthorized } from '../_shared/cron-auth.ts'

function edgeBatchLimit(body: { limit?: number } | null): number {
  const envRaw = readRuntimeEnv('QUICK_ADD_EDGE_BATCH_SIZE')
  const envN = envRaw ? Number(envRaw) : 1
  const envDefault =
    Number.isFinite(envN) && envN > 0 ? Math.min(Math.floor(envN), 3) : 1

  if (body?.limit !== undefined && Number.isFinite(body.limit)) {
    return Math.min(Math.max(1, Math.floor(body.limit)), 3)
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
    const result = await processPendingQuickAddJobs(supabase, {
      limit,
      sequential: true,
    })
    return new Response(JSON.stringify({ ...result, worker: 'edge' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed'
    console.error('process-creator-quick-add:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

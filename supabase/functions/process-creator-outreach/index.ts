// @ts-nocheck — Deno deploy target; not typechecked by Next.js tsc
/**
 * Supabase Edge Function: cron proxy → Vercel queue worker (rules → outreach_sends queued).
 * Email sends: process-creator-outreach-sends (Missive on Edge).
 *
 * Secrets: CREATOR_OUTREACH_CRON_SECRET, APP_URL
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const appUrl = Deno.env.get('APP_URL')?.replace(/\/$/, '')
  const secret = Deno.env.get('CREATOR_OUTREACH_CRON_SECRET')

  if (!appUrl || !secret) {
    return new Response(
      JSON.stringify({ error: 'APP_URL and CREATOR_OUTREACH_CRON_SECRET must be set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const res = await fetch(`${appUrl}/api/creator-pipeline/process-outreach`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
})

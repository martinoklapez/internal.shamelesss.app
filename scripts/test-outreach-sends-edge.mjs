/**
 * Invoke process-creator-outreach-sends using vars from .env.local.
 * Usage: node scripts/test-outreach-sends-edge.mjs [limit]
 */
import { loadEnvLocal } from './load-env-local.mjs'

const env = loadEnvLocal()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const cronSecret = env.CREATOR_OUTREACH_CRON_SECRET?.trim()

if (!supabaseUrl || !cronSecret) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or CREATOR_OUTREACH_CRON_SECRET in .env.local'
  )
  process.exit(1)
}

const limitArg = process.argv[2]
const body =
  limitArg !== undefined && limitArg !== ''
    ? { limit: Number(limitArg) }
    : {}

const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/process-creator-outreach-sends`

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cronSecret}`,
  },
  body: JSON.stringify(body),
})

const text = await res.text()
console.log(`HTTP ${res.status}`)
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2))
} catch {
  console.log(text)
}

if (!res.ok) process.exit(1)

/**
 * Seed 5 cron-test contacts (paulo.klapez+…@gmail.com) and queue outreach sends.
 * Reads .env.local; calls local/process-outreach API with CREATOR_OUTREACH_CRON_SECRET.
 *
 * Usage: node scripts/queue-test-outreach.mjs
 * Requires: dev server on APP_URL (default http://localhost:3000) for queue step.
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvLocal } from './load-env-local.mjs'

const env = loadEnvLocal()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const cronSecret = env.CREATOR_OUTREACH_CRON_SECRET?.trim()
const appUrl = (env.APP_URL?.trim() || 'http://localhost:3000').replace(/\/$/, '')

if (!supabaseUrl || !serviceKey || !cronSecret) {
  console.error(
    'Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CREATOR_OUTREACH_CRON_SECRET in .env.local'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const db = supabase.schema('creator_pipeline')

const runId = Date.now().toString(36)
const emails = Array.from({ length: 5 }, (_, i) => `paulo.klapez+cron-${runId}-${i + 1}@gmail.com`)

console.log('Seeding 5 test contacts:')
for (const email of emails) console.log(`  - ${email}`)

const created = []

for (let i = 0; i < emails.length; i++) {
  const email = emails[i]
  const label = `Cron test ${i + 1} (${runId})`

  const { data: creator, error: creatorError } = await db
    .from('creators')
    .insert({ display_name: label, notes: 'cron outreach test — safe to delete' })
    .select('id')
    .single()

  if (creatorError) {
    console.error('Failed to create creator:', creatorError.message)
    process.exit(1)
  }

  const { data: contact, error: contactError } = await db
    .from('contacts')
    .insert({
      kind: 'creator',
      name: label,
      email,
      notes: 'cron outreach test — safe to delete',
      status: 'new',
    })
    .select('id')
    .single()

  if (contactError) {
    console.error('Failed to create contact:', contactError.message)
    process.exit(1)
  }

  const { error: assocError } = await db.from('associations').insert({
    creator_id: creator.id,
    contact_id: contact.id,
  })

  if (assocError) {
    console.error('Failed to link association:', assocError.message)
    process.exit(1)
  }

  created.push({ creatorId: creator.id, contactId: contact.id, email })
}

const { count: pendingEvents, error: eventsError } = await db
  .from('outreach_events')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'pending')
  .in(
    'contact_id',
    created.map((c) => c.contactId)
  )

if (eventsError) {
  console.error('Failed to count outreach_events:', eventsError.message)
  process.exit(1)
}

console.log(`\nOutreach events (pending) for new contacts: ${pendingEvents ?? 0}`)

console.log(`\nQueueing sends via POST ${appUrl}/api/creator-pipeline/process-outreach ...`)

const queueRes = await fetch(`${appUrl}/api/creator-pipeline/process-outreach`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cronSecret}`,
  },
  body: JSON.stringify({
    contactIds: created.map((c) => c.contactId),
  }),
})

const queueText = await queueRes.text()
console.log(`Queue API HTTP ${queueRes.status}`)
try {
  console.log(JSON.stringify(JSON.parse(queueText), null, 2))
} catch {
  console.log(queueText)
}

if (!queueRes.ok) {
  console.error('\nQueue step failed — is npm run dev running on APP_URL?')
  process.exit(1)
}

const { count: queuedSends, error: sendsError } = await db
  .from('outreach_sends')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'queued')
  .in('email', emails)

if (sendsError) {
  console.error('Failed to count outreach_sends:', sendsError.message)
  process.exit(1)
}

console.log(`\nQueued outreach_sends for test emails: ${queuedSends ?? 0}`)
console.log('\nNext: wait ~2 min for pg_cron, or run: npm run test:outreach-sends-edge')

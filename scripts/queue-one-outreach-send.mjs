/**
 * Queue one outreach send for paulo.klapez+script@gmail.com (reads .env.local).
 * Fire with: npm run test:outreach-sends-edge
 * Or curl (printed at end).
 *
 * Usage: node scripts/queue-one-outreach-send.mjs
 */
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { loadEnvLocal } from './load-env-local.mjs'

const TEST_EMAIL = 'paulo.klapez+script@gmail.com'

const env = loadEnvLocal()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const cronSecret = env.CREATOR_OUTREACH_CRON_SECRET?.trim()

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

const email = TEST_EMAIL.trim().toLowerCase()

const { data: template, error: templateError } = await db
  .from('email_templates')
  .select('id, name')
  .order('is_default', { ascending: false })
  .order('name', { ascending: true })
  .limit(1)
  .maybeSingle()

if (templateError || !template) {
  console.error('No email template found:', templateError?.message ?? 'empty')
  process.exit(1)
}

const { data: sendFrom, error: sendFromError } = await db
  .from('send_from_addresses')
  .select('id, address, display_name')
  .eq('enabled', true)
  .order('is_default', { ascending: false })
  .limit(1)
  .maybeSingle()

if (sendFromError || !sendFrom) {
  console.error('No enabled send-from address:', sendFromError?.message ?? 'empty')
  process.exit(1)
}

let contactId
let creatorId

const { data: existingContact } = await db
  .from('contacts')
  .select('id')
  .eq('email', email)
  .limit(1)
  .maybeSingle()

if (existingContact) {
  contactId = existingContact.id
  const { data: assoc } = await db
    .from('associations')
    .select('creator_id')
    .eq('contact_id', contactId)
    .limit(1)
    .maybeSingle()
  creatorId = assoc?.creator_id ?? null
  console.log(`Using existing contact ${contactId}`)
} else {
  const { data: creator, error: creatorError } = await db
    .from('creators')
    .insert({
      display_name: 'Script outreach test',
      notes: 'queue-one-outreach-send.mjs — safe to delete',
    })
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
      name: 'Script outreach test',
      email,
      notes: 'queue-one-outreach-send.mjs — safe to delete',
      status: 'new',
    })
    .select('id')
    .single()

  if (contactError) {
    console.error('Failed to create contact:', contactError.message)
    process.exit(1)
  }

  contactId = contact.id
  creatorId = creator.id

  const { error: assocError } = await db.from('associations').insert({
    creator_id: creator.id,
    contact_id: contact.id,
  })

  if (assocError) {
    console.error('Failed to link association:', assocError.message)
    process.exit(1)
  }

  console.log(`Created contact ${contactId} + creator ${creatorId}`)
}

const { error: clearQueuedError } = await db
  .from('outreach_sends')
  .delete()
  .eq('email', email)
  .eq('status', 'queued')

if (clearQueuedError) {
  console.error('Failed to clear old queued sends:', clearQueuedError.message)
  process.exit(1)
}

const sendId = randomUUID()
const now = new Date().toISOString()

const { error: insertError } = await db.from('outreach_sends').insert({
  id: sendId,
  email,
  template_id: template.id,
  template_name: template.name,
  from_address: sendFrom.address,
  from_display_name: sendFrom.display_name,
  contact_id: contactId,
  creator_id: creatorId,
  status: 'queued',
  sent_at: now,
})

if (insertError) {
  console.error('Failed to queue outreach send:', insertError.message)
  process.exit(1)
}

console.log('\nQueued outreach send:')
console.log(`  email:   ${email}`)
console.log(`  send id: ${sendId}`)
console.log(`  from:    ${sendFrom.address}`)
console.log(`  template: ${template.name}`)

const edgeUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/process-creator-outreach-sends`

console.log('\nFire send (npm):')
console.log('  npm run test:outreach-sends-edge')

console.log('\nFire send (curl):')
console.log(`curl -sS -X POST '${edgeUrl}' \\`)
console.log(`  -H 'Content-Type: application/json' \\`)
console.log(`  -H 'Authorization: Bearer ${cronSecret}' \\`)
console.log(`  -d '{}'`)

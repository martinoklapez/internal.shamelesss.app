/**
 * Pull Twilio Incoming Phone Numbers and upsert into public.phone_numbers.
 *
 * Requires in .env.local:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/sync-twilio-phone-numbers.mjs
 *   npm run sync:twilio-phones
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvLocal } from './load-env-local.mjs'

const env = loadEnvLocal()

const accountSid = env.TWILIO_ACCOUNT_SID?.trim()
const authToken = env.TWILIO_AUTH_TOKEN?.trim()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!accountSid || !authToken) {
  console.error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in .env.local')
  process.exit(1)
}

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

function normalizeE164(value) {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('+')) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  return digits ? `+${digits}` : trimmed
}

async function listTwilioIncomingPhoneNumbers() {
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`
  const results = []
  let url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PageSize=100`

  while (url) {
    const res = await fetch(url, { headers: { Authorization: authHeader } })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || `Twilio HTTP ${res.status}`)
    }
    for (const row of data.incoming_phone_numbers ?? []) {
      results.push({
        sid: row.sid,
        phone_number: normalizeE164(row.phone_number),
        friendly_name: row.friendly_name?.trim() || null,
        iso_country: row.iso_country?.trim()?.toUpperCase() || null,
      })
    }
    url = data.next_page_uri ? `https://api.twilio.com${data.next_page_uri}` : null
  }

  return results
}

async function syncTwilioPhoneNumbers(supabase) {
  const incoming = await listTwilioIncomingPhoneNumbers()
  let created = 0
  let updated = 0
  let skipped = 0
  const now = new Date().toISOString()

  for (const row of incoming) {
    const { data: byE164 } = await supabase
      .from('phone_numbers')
      .select('id, e164, twilio_sid, friendly_name, country, status')
      .eq('e164', row.phone_number)
      .maybeSingle()

    let existing = byE164

    if (!existing && row.sid) {
      const { data: bySid } = await supabase
        .from('phone_numbers')
        .select('id, e164, twilio_sid, friendly_name, country, status')
        .eq('twilio_sid', row.sid)
        .maybeSingle()
      existing = bySid
    }

    if (existing) {
      const patch = { updated_at: now }
      let changed = false

      if (existing.e164 !== row.phone_number) {
        patch.e164 = row.phone_number
        changed = true
      }
      if (existing.twilio_sid !== row.sid) {
        patch.twilio_sid = row.sid
        changed = true
      }
      if (row.friendly_name && existing.friendly_name !== row.friendly_name) {
        patch.friendly_name = row.friendly_name
        changed = true
      }
      if (row.iso_country && existing.country !== row.iso_country) {
        patch.country = row.iso_country
        changed = true
      }
      if (existing.status === 'released') {
        patch.status = 'active'
        changed = true
      }

      if (changed) {
        const { error } = await supabase.from('phone_numbers').update(patch).eq('id', existing.id)
        if (error) throw new Error(`Update ${row.phone_number}: ${error.message}`)
        updated++
      } else {
        skipped++
      }
      continue
    }

    const { error: insertError } = await supabase.from('phone_numbers').insert({
      e164: row.phone_number,
      twilio_sid: row.sid,
      friendly_name: row.friendly_name,
      country: row.iso_country,
      status: 'active',
      purpose: 'general',
      notes: 'Synced from Twilio',
    })

    if (insertError) {
      if (insertError.code === '23505') {
        skipped++
        continue
      }
      throw new Error(`Insert ${row.phone_number}: ${insertError.message}`)
    }

    created++
  }

  return { total: incoming.length, created, updated, skipped }
}

console.log('Syncing Twilio incoming phone numbers…')

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

try {
  const result = await syncTwilioPhoneNumbers(supabase)
  console.log('Sync complete')
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

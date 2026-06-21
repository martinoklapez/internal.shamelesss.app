import type { SupabaseClient } from '@supabase/supabase-js'
import { countryCodeFromE164 } from '@/lib/normalize-phone'
import { listTwilioIncomingPhoneNumbers } from '@/lib/twilio/incoming-numbers'

export interface SyncTwilioPhoneNumbersResult {
  total: number
  created: number
  updated: number
  skipped: number
}

function resolvePhoneCountry(isoFromTwilio: string | null, e164: string): string | null {
  return isoFromTwilio ?? countryCodeFromE164(e164)
}

export async function syncTwilioPhoneNumbers(
  supabase: SupabaseClient
): Promise<SyncTwilioPhoneNumbersResult> {
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
      const patch: Record<string, unknown> = { updated_at: now }
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
      const resolvedCountry = resolvePhoneCountry(row.iso_country, row.phone_number)
      if (resolvedCountry && existing.country !== resolvedCountry) {
        patch.country = resolvedCountry
        changed = true
      }
      if (existing.status === 'released') {
        patch.status = 'active'
        changed = true
      }

      if (changed) {
        const { error } = await supabase
          .from('phone_numbers')
          .update(patch)
          .eq('id', existing.id)

        if (error) {
          throw new Error(`Failed to update ${row.phone_number}: ${error.message}`)
        }
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
      country: resolvePhoneCountry(row.iso_country, row.phone_number),
      status: 'active',
      purpose: 'general',
      notes: 'Synced from Twilio',
    })

    if (insertError) {
      if (insertError.code === '23505') {
        skipped++
        continue
      }
      throw new Error(`Failed to insert ${row.phone_number}: ${insertError.message}`)
    }

    created++
  }

  return { total: incoming.length, created, updated, skipped }
}

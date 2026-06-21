import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireDeviceManagerUser } from '@/lib/api/device-manager-auth'
import { requirePhoneAdmin } from '@/lib/api/phone-number-auth'
import { listPhoneNumbers } from '@/lib/database/phone-numbers'
import { countryCodeFromE164 } from '@/lib/normalize-phone'
import { normalizeE164 } from '@/lib/twilio/send-sms'

export async function GET() {
  const auth = await requireDeviceManagerUser()
  if (!auth.ok) return auth.response

  try {
    const numbers = await listPhoneNumbers()
    return NextResponse.json(numbers)
  } catch (error) {
    console.error('GET /api/phone-numbers:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list phone numbers' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requirePhoneAdmin()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const { e164, twilio_sid, friendly_name, country, purpose, notes, icloud_profile_id, assigned_user_id } =
      body

    if (!e164 || typeof e164 !== 'string') {
      return NextResponse.json({ error: 'e164 is required' }, { status: 400 })
    }

    const normalized = normalizeE164(e164)
    if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
      return NextResponse.json({ error: 'Invalid E.164 phone number' }, { status: 400 })
    }

    const validPurposes = ['tiktok_signup', 'instagram_signup', 'general'] as const
    const resolvedPurpose =
      typeof purpose === 'string' && validPurposes.includes(purpose as (typeof validPurposes)[number])
        ? purpose
        : 'general'

    const supabase = await createClient()

    if (icloud_profile_id) {
      const { data: conflict } = await supabase
        .from('phone_numbers')
        .select('id')
        .eq('icloud_profile_id', icloud_profile_id)
        .neq('status', 'released')
        .maybeSingle()

      if (conflict) {
        return NextResponse.json(
          { error: 'This iCloud profile already has a phone number linked' },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase
      .from('phone_numbers')
      .insert({
        e164: normalized,
        twilio_sid: twilio_sid?.trim() || null,
        friendly_name: friendly_name?.trim() || null,
        country: country?.trim() || countryCodeFromE164(normalized),
        purpose: resolvedPurpose,
        notes: notes?.trim() || null,
        icloud_profile_id: icloud_profile_id || null,
        assigned_user_id: assigned_user_id || null,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Phone number already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/phone-numbers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

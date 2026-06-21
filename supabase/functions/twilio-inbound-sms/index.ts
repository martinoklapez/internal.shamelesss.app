// @ts-nocheck — Deno deploy target
/**
 * Twilio inbound SMS webhook → validate signature → insert sms_messages → empty TwiML.
 *
 * Secrets: TWILIO_AUTH_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: TWILIO_WEBHOOK_URL — exact URL configured in Twilio (for signature validation)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { validateTwilioSignature } from '../_shared/twilio-signature.ts'
import { parseTwilioWebhookParams } from '../_shared/twilio-webhook-body.ts'

const EMPTY_TWIML =
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

function twimlResponse(status = 200): Response {
  return new Response(EMPTY_TWIML, {
    status,
    headers: { 'Content-Type': 'text/xml' },
  })
}

function normalizeE164(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('+')) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  return digits ? `+${digits}` : trimmed
}

async function getOrCreatePhoneNumberId(
  supabase: ReturnType<typeof createClient>,
  toE164: string
): Promise<string | null> {
  const { data: existing, error: lookupError } = await supabase
    .from('phone_numbers')
    .select('id, status')
    .eq('e164', toE164)
    .maybeSingle()

  if (lookupError) {
    console.error('twilio-inbound-sms: phone lookup failed', lookupError.code, lookupError.message)
    return null
  }

  if (existing) {
    if (existing.status === 'released') {
      const { error: reactivateError } = await supabase
        .from('phone_numbers')
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (reactivateError) {
        console.error('twilio-inbound-sms: reactivate failed', reactivateError.message)
        return null
      }
    }
    return existing.id
  }

  const { data: inserted, error: insertError } = await supabase
    .from('phone_numbers')
    .insert({
      e164: toE164,
      status: 'active',
      purpose: 'general',
      notes: 'Auto-registered from inbound SMS',
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: retry, error: retryError } = await supabase
        .from('phone_numbers')
        .select('id')
        .eq('e164', toE164)
        .maybeSingle()

      if (retryError || !retry) {
        console.error('twilio-inbound-sms: race retry failed', retryError?.message)
        return null
      }
      return retry.id
    }
    console.error('twilio-inbound-sms: auto-register failed', insertError.code, insertError.message)
    return null
  }

  console.log('twilio-inbound-sms: auto-registered', toE164)
  return inserted.id
}

serve(async (req) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return new Response('Twilio SMS webhook OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')?.trim()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!authToken) {
      console.error('twilio-inbound-sms: TWILIO_AUTH_TOKEN secret is not set on Edge')
      return twimlResponse(500)
    }
    if (!supabaseUrl || !serviceKey) {
      console.error('twilio-inbound-sms: Supabase env missing')
      return twimlResponse(500)
    }

    const params = await parseTwilioWebhookParams(req)

    const configuredUrl = Deno.env.get('TWILIO_WEBHOOK_URL')?.trim()
    const requestUrl = new URL(req.url)
    const validationUrl =
      configuredUrl || `${requestUrl.origin}${requestUrl.pathname}`

    const signature = req.headers.get('X-Twilio-Signature')
    const valid = await validateTwilioSignature(
      authToken,
      signature,
      validationUrl,
      params
    )

    if (!valid) {
      console.warn(
        'twilio-inbound-sms: invalid signature',
        JSON.stringify({
          validationUrl,
          hasSignature: Boolean(signature),
          paramKeys: Object.keys(params),
        })
      )
      return new Response('Forbidden', { status: 403 })
    }

    const fromRaw = params.From ?? ''
    const toRaw = params.To ?? ''
    const body = params.Body ?? ''
    const messageSid = params.MessageSid ?? params.SmsMessageSid ?? null

    if (!toRaw || !messageSid) {
      console.warn(
        'twilio-inbound-sms: missing To or MessageSid',
        JSON.stringify({ keys: Object.keys(params) })
      )
      return twimlResponse()
    }

    const toE164 = normalizeE164(toRaw)
    const fromE164 = normalizeE164(fromRaw)

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const phoneNumberId = await getOrCreatePhoneNumberId(supabase, toE164)

    if (!phoneNumberId) {
      console.error('twilio-inbound-sms: could not resolve phone_number for', toE164)
      return twimlResponse(500)
    }

    const { error: insertError } = await supabase.from('sms_messages').insert({
      phone_number_id: phoneNumberId,
      direction: 'inbound',
      from_e164: fromE164,
      to_e164: toE164,
      body,
      twilio_message_sid: messageSid,
      status: 'received',
    })

    if (insertError) {
      if (insertError.code === '23505') {
        return twimlResponse()
      }
      console.error('twilio-inbound-sms: insert failed', insertError.code, insertError.message)
      return twimlResponse(500)
    }

    console.log('twilio-inbound-sms: stored inbound SMS', messageSid, 'for', toE164)
    return twimlResponse()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('twilio-inbound-sms: unhandled error', message)
    return twimlResponse(500)
  }
})

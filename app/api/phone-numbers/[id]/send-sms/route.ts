import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePhoneNumberAccess } from '@/lib/api/phone-number-auth'
import { sendTwilioSms, normalizeE164 } from '@/lib/twilio/send-sms'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  const auth = await requirePhoneNumberAccess(id)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const { to, message } = body

    if (!to || typeof to !== 'string') {
      return NextResponse.json({ error: 'to is required' }, { status: 400 })
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: phoneNumber, error: lookupError } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('id', id)
      .neq('status', 'released')
      .single()

    if (lookupError || !phoneNumber) {
      return NextResponse.json({ error: 'Phone number not found' }, { status: 404 })
    }

    const toE164 = normalizeE164(to)
    const fromE164 = phoneNumber.e164

    const twilioResult = await sendTwilioSms({
      to: toE164,
      from: fromE164,
      body: message.trim(),
    })

    const twilioStatus = twilioResult.status
    const smsStatus =
      twilioStatus === 'delivered'
        ? 'delivered'
        : twilioStatus === 'failed' || twilioStatus === 'undelivered'
          ? 'failed'
          : twilioStatus === 'sent'
            ? 'sent'
            : 'queued'

    const { data: smsRow, error: insertError } = await supabase
      .from('sms_messages')
      .insert({
        phone_number_id: phoneNumber.id,
        direction: 'outbound',
        from_e164: fromE164,
        to_e164: toE164,
        body: message.trim(),
        twilio_message_sid: twilioResult.sid || null,
        status: smsStatus,
      })
      .select()
      .single()

    if (insertError) {
      console.error('send-sms insert failed:', insertError)
      return NextResponse.json(
        {
          error: 'SMS sent via Twilio but failed to save to inbox',
          twilio: twilioResult,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: smsRow, twilio: twilioResult })
  } catch (error) {
    console.error('POST /api/phone-numbers/[id]/send-sms:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send SMS' },
      { status: 500 }
    )
  }
}

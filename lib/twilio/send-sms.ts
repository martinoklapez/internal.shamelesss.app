import { getTwilioCredentials, twilioBasicAuthHeader } from '@/lib/twilio/client'
import { normalizeE164 } from '@/lib/twilio/e164'

export { normalizeE164 }

export interface TwilioSendResult {
  sid: string
  status: string
  to: string
  from: string
}

export async function sendTwilioSms(options: {
  to: string
  from: string
  body: string
}): Promise<TwilioSendResult> {
  const { accountSid, authToken } = getTwilioCredentials()
  const to = normalizeE164(options.to)
  const from = normalizeE164(options.from)

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const form = new URLSearchParams({
    To: to,
    From: from,
    Body: options.body,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: twilioBasicAuthHeader(accountSid, authToken),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  })

  const text = await res.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Twilio returned non-JSON (${res.status}): ${text.slice(0, 200)}`)
  }

  if (!res.ok) {
    const message =
      typeof data.message === 'string'
        ? data.message
        : `Twilio error HTTP ${res.status}`
    throw new Error(message)
  }

  return {
    sid: String(data.sid ?? ''),
    status: String(data.status ?? 'queued'),
    to: String(data.to ?? to),
    from: String(data.from ?? from),
  }
}

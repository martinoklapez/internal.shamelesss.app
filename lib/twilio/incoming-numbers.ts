import { getTwilioCredentials, twilioBasicAuthHeader } from '@/lib/twilio/client'
import { normalizeE164 } from '@/lib/twilio/e164'

export interface TwilioIncomingPhoneNumber {
  sid: string
  phone_number: string
  friendly_name: string | null
  iso_country: string | null
}

interface TwilioListResponse {
  incoming_phone_numbers: Array<{
    sid: string
    phone_number: string
    friendly_name?: string | null
    iso_country?: string | null
  }>
  next_page_uri: string | null
}

export async function listTwilioIncomingPhoneNumbers(): Promise<TwilioIncomingPhoneNumber[]> {
  const { accountSid, authToken } = getTwilioCredentials()
  const authHeader = twilioBasicAuthHeader(accountSid, authToken)

  const results: TwilioIncomingPhoneNumber[] = []
  let url: string | null =
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PageSize=100`

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: authHeader },
    })

    const text = await res.text()
    let data: TwilioListResponse
    try {
      data = JSON.parse(text) as TwilioListResponse
    } catch {
      throw new Error(`Twilio returned non-JSON (${res.status}): ${text.slice(0, 200)}`)
    }

    if (!res.ok) {
      const message =
        typeof (data as unknown as { message?: string }).message === 'string'
          ? (data as unknown as { message: string }).message
          : `Twilio error HTTP ${res.status}`
      throw new Error(message)
    }

    for (const row of data.incoming_phone_numbers ?? []) {
      results.push({
        sid: row.sid,
        phone_number: normalizeE164(row.phone_number),
        friendly_name: row.friendly_name?.trim() || null,
        iso_country: row.iso_country?.trim()?.toUpperCase() || null,
      })
    }

    url = data.next_page_uri
      ? `https://api.twilio.com${data.next_page_uri}`
      : null
  }

  return results
}

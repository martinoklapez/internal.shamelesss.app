/**
 * Validate Twilio webhook X-Twilio-Signature header.
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export async function validateTwilioSignature(
  authToken: string,
  signature: string | null,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  if (!signature || !authToken) return false

  const sortedKeys = Object.keys(params).sort()
  let data = url
  for (const key of sortedKeys) {
    data += key + params[key]
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const bytes = new Uint8Array(sigBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  const expected = btoa(binary)
  return expected === signature
}

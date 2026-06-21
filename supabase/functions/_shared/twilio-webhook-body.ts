/**
 * Parse Twilio webhook POST body (application/x-www-form-urlencoded).
 */
export async function parseTwilioWebhookParams(
  req: Request
): Promise<Record<string, string>> {
  const contentType = req.headers.get('content-type') ?? ''
  const params: Record<string, string> = {}

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const raw = await req.text()
    for (const [key, value] of new URLSearchParams(raw).entries()) {
      params[key] = value
    }
    return params
  }

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString()
    }
    return params
  }

  const raw = await req.text()
  if (!raw.trim()) return params

  try {
    if (raw.trim().startsWith('{')) {
      const json = JSON.parse(raw) as Record<string, unknown>
      for (const [key, value] of Object.entries(json)) {
        if (value != null) params[key] = String(value)
      }
      return params
    }
  } catch {
    // fall through to URLSearchParams
  }

  for (const [key, value] of new URLSearchParams(raw).entries()) {
    params[key] = value
  }
  return params
}

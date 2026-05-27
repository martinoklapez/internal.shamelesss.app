import { CHAT_TRANSLATE_TARGET_CODES } from '@/lib/chat-translate-config'

/** Google Cloud Translation API v2 allows ~5k chars per request for standard tier. */
const MAX_CHARS = 4500

export function isGoogleTranslateConfigured(): boolean {
  return Boolean(process.env.GOOGLE_TRANSLATE_API_KEY?.trim())
}

export async function googleTranslateText(
  text: string,
  targetLanguageCode: string
): Promise<{ translatedText: string; detectedSourceLanguage?: string }> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('GOOGLE_TRANSLATE_API_KEY is not set')
  }

  const target = targetLanguageCode.trim().toLowerCase()
  if (!CHAT_TRANSLATE_TARGET_CODES.has(target)) {
    throw new Error('Unsupported target language')
  }

  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('Nothing to translate')
  }

  const q = trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS) : trimmed

  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q,
      target,
      format: 'text',
    }),
  })

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new Error('Invalid response from Translation API')
  }

  if (!res.ok) {
    const errObj = json as { error?: { message?: string } }
    const msg =
      typeof errObj?.error?.message === 'string'
        ? errObj.error.message
        : `Translation API HTTP ${res.status}`
    throw new Error(msg)
  }

  const data = json as {
    data?: {
      translations?: Array<{ translatedText?: string; detectedSourceLanguage?: string }>
    }
  }
  const first = data?.data?.translations?.[0]
  const translatedText =
    typeof first?.translatedText === 'string' ? first.translatedText.trim() : ''
  if (!translatedText) {
    throw new Error('Unexpected Translation API response')
  }

  const detected =
    typeof first?.detectedSourceLanguage === 'string'
      ? first.detectedSourceLanguage.trim()
      : undefined

  return { translatedText, detectedSourceLanguage: detected || undefined }
}

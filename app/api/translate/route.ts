import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/api/admin-auth'
import { CHAT_TRANSLATE_TARGET_CODES } from '@/lib/chat-translate-config'
import { googleTranslateText, isGoogleTranslateConfigured } from '@/lib/google-translate'

export const dynamic = 'force-dynamic'

/** GET: whether Translation API env is present (admin-only). */
export async function GET() {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response
  return NextResponse.json({ configured: isGoogleTranslateConfigured() })
}

/** POST: translate chat snippet (admin-only). Body: `{ text, target }`. */
export async function POST(request: Request) {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  if (!isGoogleTranslateConfigured()) {
    return NextResponse.json(
      {
        error:
          'Translation API is not configured. Add GOOGLE_TRANSLATE_API_KEY to the server environment.',
      },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const obj = body as { text?: unknown; target?: unknown }
  const text = typeof obj.text === 'string' ? obj.text : ''
  const targetRaw = typeof obj.target === 'string' ? obj.target.trim().toLowerCase() : ''

  if (!targetRaw || !CHAT_TRANSLATE_TARGET_CODES.has(targetRaw)) {
    return NextResponse.json({ error: 'Invalid or unsupported target language' }, { status: 400 })
  }

  try {
    const result = await googleTranslateText(text, targetRaw)
    return NextResponse.json(result)
  } catch (e) {
    console.error('translate POST:', e)
    const msg = e instanceof Error ? e.message : 'Translation failed'
    const status = msg.includes('GOOGLE_TRANSLATE_API_KEY') ? 503 : 502
    return NextResponse.json({ error: msg }, { status })
  }
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const BLOCKED_LOCAL_PARTS = new Set([
  'noreply',
  'no-reply',
  'donotreply',
  'mailer-daemon',
  'postmaster',
])

const BLOCKED_DOMAINS = new Set([
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'example.com',
  'test.com',
  'email.com',
  'domain.com',
  'sentry.io',
])

export function isPlausibleContactEmail(email: string): boolean {
  const normalized = normalizeEmail(email)
  if (!normalized.includes('@')) return false

  const [local, domain] = normalized.split('@')
  if (!local || !domain || domain.includes('..')) return false
  if (BLOCKED_LOCAL_PARTS.has(local)) return false
  if (BLOCKED_DOMAINS.has(domain)) return false
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(domain)) return false

  return true
}

/** Extract unique, plausible contact emails from free text (bio, etc.). */
export function extractEmailsFromText(text: string): string[] {
  if (!text.trim()) return []

  const seen = new Set<string>()
  const out: string[] = []

  for (const match of text.matchAll(EMAIL_RE)) {
    const raw = match[0].replace(/\.$/, '')
    const email = normalizeEmail(raw)
    if (!isPlausibleContactEmail(email)) continue
    if (seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }

  return out
}

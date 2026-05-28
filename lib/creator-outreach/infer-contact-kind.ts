import type { CreatorContactKind, CreatorOutreachStore } from './types'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const REP_INBOX_PATTERN =
  /agency|mgmt|management|booking|bookings|talent|representation|publicity|media-kit/i

const REP_LOCAL_PREFIX =
  /^(contact|hello|info|team|booking|bookings|press|talent|mgmt|office|support|admin)(\+|$|\.|_)/i

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'icloud.com',
  'me.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
])

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function nameTokens(displayName: string): string[] {
  return displayName
    .trim()
    .split(/\s+/)
    .map(normalizeToken)
    .filter((t) => t.length >= 2)
}

function localPart(email: string): string {
  return email.split('@')[0] ?? ''
}

function emailDomain(email: string): string {
  return email.split('@')[1] ?? ''
}

function looksLikeRepInbox(email: string, name?: string): boolean {
  const haystack = `${email} ${name ?? ''}`
  if (REP_INBOX_PATTERN.test(haystack)) return true
  return REP_LOCAL_PREFIX.test(localPart(email))
}

function localMatchesName(local: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false
  const first = tokens[0]
  const last = tokens[tokens.length - 1]

  if (tokens.length >= 2) {
    const variants = [
      first + last,
      first + last.slice(0, 1),
      first.slice(0, 1) + last,
      last + first,
    ].map(normalizeToken)
    if (variants.some((v) => v.length >= 4 && (local === v || local.includes(v)))) {
      return true
    }
  }

  if (first.length >= 3 && (local === first || local.startsWith(first) || local.includes(first))) {
    return true
  }

  return false
}

function localMatchesHandle(local: string, handles: string[]): boolean {
  for (const handle of handles) {
    const flat = normalizeToken(handle)
    if (flat.length < 4) continue
    if (local === flat || local.includes(flat) || flat.includes(local)) return true
  }
  return false
}

function looksLikeCreatorDirectEmail(
  email: string,
  displayName: string,
  handles: string[]
): boolean {
  if (looksLikeRepInbox(email)) return false

  const local = normalizeToken(localPart(email))
  if (local.length < 3) return false

  const tokens = nameTokens(displayName)
  const domain = emailDomain(email)

  if (localMatchesHandle(local, handles)) return true
  if (localMatchesName(local, tokens)) {
    if (PERSONAL_EMAIL_DOMAINS.has(domain)) return true
    if (tokens.length >= 2) return true
  }

  return false
}

/** Classify contact kind from email + creator context (creator = direct inbox). */
export function inferCreatorContactKind(
  store: CreatorOutreachStore,
  creatorId: string,
  email: string,
  name?: string
): CreatorContactKind {
  const normalized = normalizeEmail(email)
  if (!normalized.includes('@')) return 'other'

  if (looksLikeRepInbox(normalized, name)) {
    const haystack = `${normalized} ${name ?? ''}`
    if (/agency|booking|bookings|talent/i.test(haystack)) return 'agency'
    return 'manager'
  }

  const creator = store.creators.find((c) => c.id === creatorId)
  const handles = store.profiles
    .filter((p) => p.creatorId === creatorId)
    .map((p) => p.handle)

  if (
    creator &&
    looksLikeCreatorDirectEmail(normalized, creator.displayName, handles)
  ) {
    return 'creator'
  }

  return 'other'
}

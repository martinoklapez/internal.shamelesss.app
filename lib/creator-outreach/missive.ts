import type { OutreachSend } from './types'

const MISSIVE_API_BASE = 'https://public.missiveapp.com/v1'

export type MissiveSendResult =
  | { ok: true; conversationId: string }
  | { ok: false; reason: string }

export type MissiveSendContext = {
  contactName: string
  creatorName: string
  platform?: string
  handle?: string
  /** Reply in an existing Missive thread when present. */
  existingConversationId?: string | null
}

type MissiveDraftPayload = {
  subject?: string
  body: string
  send: boolean
  to_fields: { address: string; name?: string }[]
  from_field: { address: string; name?: string }
  conversation?: string
  team?: string
  organization?: string
  add_to_team_inbox?: boolean
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Plain text or simple HTML → Missive-friendly HTML (paragraph spacing). */
export function textToMissiveHtml(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return '<div><br></div>'
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed
  return trimmed
    .split(/\n\n+/)
    .map((paragraph) => {
      const inner = escapeHtml(paragraph).replace(/\n/g, '<br>')
      return `<div>${inner}</div>`
    })
    .join('<div><br></div>')
}

export function renderOutreachTemplate(
  text: string,
  vars: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`)
}

function replySubject(subject: string): string {
  const trimmed = subject.trim()
  if (/^re:\s/i.test(trimmed)) return trimmed
  return `Re: ${trimmed}`
}

function parseMissiveErrorMessage(data: unknown, raw: string, status: number): string {
  if (data && typeof data === 'object' && data !== null) {
    const root = data as Record<string, unknown>
    if (root.error && typeof root.error === 'object' && root.error !== null) {
      const msg = (root.error as { message?: unknown }).message
      if (typeof msg === 'string' && msg.trim()) return msg.trim()
    }
    if (typeof root.message === 'string' && root.message.trim()) {
      return root.message.trim()
    }
  }
  return raw.slice(0, 300) || `HTTP ${status}`
}

function isSenderMismatchError(message: string): boolean {
  return message.toLowerCase().includes('does not match an available sender')
}

function senderMismatchHelp(configured: string, tried: string[]): string {
  return (
    `Missive cannot send from "${configured}" with this API token. ` +
    `Sending requires an alias the token owner is allowed to send as (not only compose with). ` +
    `Tried: ${tried.join(', ')}. ` +
    `Fix: use an address that works (often the token owner's email), set MISSIVE_SEND_FROM_ADDRESS, ` +
    `or in Missive → Settings → Accounts → Aliases enable "Allow others to send" for ${configured}.`
  )
}

export async function missiveApiRequest<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; reason: string; status?: number }> {
  let res: Response
  try {
    res = await fetch(`${MISSIVE_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Missive request failed',
    }
  }

  const raw = await res.text()
  let data: unknown = null
  if (raw) {
    try {
      data = JSON.parse(raw) as unknown
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    const detail = parseMissiveErrorMessage(data, raw, res.status)
    return { ok: false, reason: `Missive API ${res.status}: ${detail}`, status: res.status }
  }

  return { ok: true, data: data as T }
}

async function getTokenOwnerEmail(token: string): Promise<string | null> {
  const result = await missiveApiRequest<{ users?: { me?: boolean; email?: string }[] }>(
    token,
    '/users',
    { method: 'GET' }
  )
  if (!result.ok) return null
  const me = result.data.users?.find((u) => u.me)
  const email = me?.email?.trim().toLowerCase()
  return email || null
}

function buildSendFromCandidates(configured: string, tokenOwnerEmail: string | null): string[] {
  const seen = new Set<string>()
  const list: string[] = []
  const add = (addr: string | undefined | null) => {
    const normalized = addr?.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    list.push(normalized)
  }
  add(configured)
  add(process.env.MISSIVE_SEND_FROM_ADDRESS)
  add(tokenOwnerEmail)
  return list
}

function conversationIdFromDraftResponse(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const root = data as Record<string, unknown>

  const drafts = root.drafts
  if (drafts && typeof drafts === 'object' && !Array.isArray(drafts)) {
    const conv = (drafts as Record<string, unknown>).conversation
    if (typeof conv === 'string' && conv) return conv
  }

  if (Array.isArray(drafts) && drafts[0] && typeof drafts[0] === 'object') {
    const conv = (drafts[0] as Record<string, unknown>).conversation
    if (typeof conv === 'string' && conv) return conv
  }

  const conversations = root.conversations
  if (Array.isArray(conversations) && conversations[0] && typeof conversations[0] === 'object') {
    const id = (conversations[0] as Record<string, unknown>).id
    if (typeof id === 'string' && id) return id
  }

  return null
}

async function findConversationByRecipientEmail(
  token: string,
  email: string
): Promise<string | null> {
  const params = new URLSearchParams({ email, limit: '1' })
  const result = await missiveApiRequest<{ conversations?: { id: string }[] }>(
    token,
    `/conversations?${params}`,
    { method: 'GET' }
  )
  if (!result.ok) return null
  const id = result.data.conversations?.[0]?.id
  return id ?? null
}

async function createAndSendDraft(
  token: string,
  draft: MissiveDraftPayload
): Promise<{ ok: true; data: unknown } | { ok: false; reason: string; senderMismatch: boolean }> {
  const created = await missiveApiRequest<unknown>(token, '/drafts', {
    method: 'POST',
    body: JSON.stringify({ drafts: draft }),
  })

  if (created.ok) {
    return { ok: true, data: created.data }
  }

  const senderMismatch = isSenderMismatchError(created.reason)
  return { ok: false, reason: created.reason, senderMismatch }
}

/**
 * Send a queued outreach row via Missive POST /v1/drafts with send: true.
 */
export async function sendQueuedOutreachViaMissive(
  send: OutreachSend,
  template: { subject: string; bodyPreview: string },
  context: MissiveSendContext
): Promise<MissiveSendResult> {
  const token = process.env.MISSIVE_API_TOKEN?.trim()
  if (!token) {
    return { ok: false, reason: 'MISSIVE_API_TOKEN not configured' }
  }

  const configuredFrom = process.env.MISSIVE_FROM_ADDRESS?.trim()
  if (!configuredFrom) {
    return {
      ok: false,
      reason: 'MISSIVE_FROM_ADDRESS not configured (must match a Missive email alias)',
    }
  }

  const tokenOwnerEmail = await getTokenOwnerEmail(token)
  const fromCandidates = buildSendFromCandidates(configuredFrom, tokenOwnerEmail)

  const vars: Record<string, string> = {
    creator_name: context.creatorName,
    contact_name: context.contactName,
    platform: context.platform ?? '',
    handle: context.handle ?? '',
  }

  const renderedSubject = renderOutreachTemplate(template.subject, vars).trim()
  const renderedBody = renderOutreachTemplate(template.bodyPreview, vars).trim()
  const body = textToMissiveHtml(renderedBody)

  const existingConversationId = context.existingConversationId?.trim() || null
  const subject = existingConversationId
    ? replySubject(renderedSubject)
    : renderedSubject

  const teamId = process.env.MISSIVE_TEAM_ID?.trim()
  const organizationId = process.env.MISSIVE_ORGANIZATION_ID?.trim()
  const fromName = process.env.MISSIVE_FROM_NAME?.trim() || undefined

  const baseDraft: Omit<MissiveDraftPayload, 'from_field'> = {
    subject,
    body,
    send: true,
    to_fields: [{ address: send.email, name: context.contactName || undefined }],
  }

  if (existingConversationId) {
    baseDraft.conversation = existingConversationId
  } else if (teamId) {
    baseDraft.team = teamId
    baseDraft.add_to_team_inbox = true
    if (organizationId) {
      baseDraft.organization = organizationId
    }
  }

  let created: { ok: true; data: unknown } | { ok: false; reason: string; senderMismatch: boolean } =
    { ok: false, reason: 'No send attempt', senderMismatch: false }
  const tried: string[] = []

  for (const fromAddress of fromCandidates) {
    tried.push(fromAddress)
    created = await createAndSendDraft(token, {
      ...baseDraft,
      from_field: { address: fromAddress, name: fromName },
    })
    if (created.ok) break
    if (!created.senderMismatch) {
      return { ok: false, reason: created.reason }
    }
  }

  if (!created.ok) {
    return {
      ok: false,
      reason: senderMismatchHelp(configuredFrom, tried),
    }
  }

  if (
    tried.length > 1 &&
    tried[0] !== tried[tried.length - 1] &&
    created.ok
  ) {
    console.warn(
      `Missive: sent from "${tried[tried.length - 1]}" because "${configuredFrom}" is not an API send alias for this token.`
    )
  }

  let conversationId =
    conversationIdFromDraftResponse(created.data) ?? existingConversationId

  if (!conversationId) {
    for (let attempt = 0; attempt < 3 && !conversationId; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
      conversationId = await findConversationByRecipientEmail(token, send.email)
    }
  }

  if (!conversationId) {
    return {
      ok: false,
      reason:
        'Missive accepted the send but no conversation id was returned. Check the team inbox in Missive.',
    }
  }

  return { ok: true, conversationId }
}

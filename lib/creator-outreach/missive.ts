import {
  type CalBookingMeetingDetails,
  outreachBodyToEmailHtml,
  replaceBookMeetingInPlainText,
} from './cal-booking'
import { appendOutreachSignatureHtml } from './outreach-email-body'
import type { OutreachSend } from './types'

const MISSIVE_API_BASE = 'https://public.missiveapp.com/v1'

export type MissiveSendResult =
  | {
      ok: true
      conversationId: string
      fromAddress: string
      configuredFromAddress: string
      /** True when the configured alias failed and send used the API token user's email. */
      personalFallback?: boolean
    }
  | { ok: false; reason: string }

export type MissivePipelineSender = {
  address: string
  missiveAccountId?: string
  displayName?: string
}

export type MissiveSendContext = {
  contactName: string
  creatorName: string
  fromAddress: string
  fromDisplayName?: string
  platform?: string
  handle?: string
  /** Reply in an existing Missive thread when present. */
  existingConversationId?: string | null
  /** Enabled Pipeline senders (address + shared account id + display name). */
  pipelineSenders?: MissivePipelineSender[]
  /** @deprecated Prefer pipelineSenders */
  fallbackFromAddresses?: string[]
  /** Missive shared email account ID when not set on the matching pipelineSenders row. */
  missiveAccountId?: string
  /** HTML signature for the configured sender (appended after template body). */
  signatureHtml?: string
  /** {{book_meeting}} card copy from the outreach sender (Pipeline → Senders). */
  bookingDetails?: Partial<CalBookingMeetingDetails>
}

type MissiveDraftPayload = {
  subject?: string
  body: string
  send: boolean
  to_fields: { address: string; name?: string }[]
  from_field: { address: string; name?: string }
  account?: string
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
  const lower = message.toLowerCase()
  return (
    lower.includes('does not match an available sender') ||
    lower.includes('cannot send from')
  )
}

function isAccountNotFoundError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('account with id') && lower.includes('does not exist')
}

function resolveMissiveAccountId(context: MissiveSendContext): string | undefined {
  const fromContext = context.missiveAccountId?.trim()
  if (fromContext) return fromContext
  return process.env.MISSIVE_ACCOUNT_ID?.trim() || undefined
}

/** True when Missive rejected the configured From address (alias / API permission). */
export function isMissiveSenderUnavailableReason(reason: string): boolean {
  return isSenderMismatchError(reason)
}

function allowPersonalEmailFallback(): boolean {
  return process.env.MISSIVE_ALLOW_PERSONAL_FALLBACK !== 'false'
}

function senderMismatchHelp(
  requested: string,
  tried: string[],
  tokenOwnerEmail: string | null,
  accountId?: string
): string {
  const triedLine = tried.length ? ` Tried: ${tried.join(', ')}.` : ''
  const ownerLine = tokenOwnerEmail
    ? ` API token user: ${tokenOwnerEmail}.`
    : ''
  const accountLine = accountId
    ? ` The Missive account ID on the sender is only used as a fallback; Gmail outreach still requires the alias in API "available senders".`
    : ''
  const fallbackLine = allowPersonalEmailFallback()
    ? ` Set MISSIVE_ALLOW_PERSONAL_FALLBACK=false to disable sending from ${tokenOwnerEmail ?? 'your personal email'} when the alias fails.`
    : ` Personal-email fallback is disabled (MISSIVE_ALLOW_PERSONAL_FALLBACK=false).`
  return (
    `Missive API cannot send from "${requested}" — this alias is not in the token user's API send list.${triedLine}${ownerLine}${accountLine} ` +
    `Fix: Missive → Settings → Accounts → your shared Gmail account → Aliases → ${requested} → ` +
    `"Allow others to send" → add ${tokenOwnerEmail ?? 'the API token user'}. Composing in the team inbox is not enough.${fallbackLine}`
  )
}

/** Email of the Missive user who owns the API token (the only guaranteed API send-from). */
export async function getMissiveTokenOwnerEmail(token: string): Promise<string | null> {
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

function normalizeEmailAddress(addr: string | undefined | null): string | null {
  const normalized = addr?.trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return null
  return normalized
}

function buildSendFromCandidates(primary: string, extras: string[]): string[] {
  const seen = new Set<string>()
  const list: string[] = []
  const add = (addr: string | undefined | null) => {
    const normalized = normalizeEmailAddress(addr)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    list.push(normalized)
  }
  add(primary)
  for (const extra of extras) add(extra)
  add(process.env.MISSIVE_FROM_ADDRESS)
  add(process.env.MISSIVE_SEND_FROM_ADDRESS)
  return list
}

function pipelineSenderForAddress(
  context: MissiveSendContext,
  address: string
): MissivePipelineSender | undefined {
  const normalized = address.toLowerCase()
  return context.pipelineSenders?.find((s) => s.address.toLowerCase() === normalized)
}

function accountIdForAddress(context: MissiveSendContext, address: string): string | undefined {
  const fromRow = pipelineSenderForAddress(context, address)?.missiveAccountId?.trim()
  if (fromRow) return fromRow
  if (address.toLowerCase() === normalizeEmailAddress(context.fromAddress)) {
    return resolveMissiveAccountId(context)
  }
  return undefined
}

function displayNameForAddress(
  context: MissiveSendContext,
  address: string,
  fallback?: string
): string | undefined {
  const fromRow = pipelineSenderForAddress(context, address)?.displayName?.trim()
  return fromRow || fallback
}

function hasSharedInboxConfigured(context: MissiveSendContext): boolean {
  if (resolveMissiveAccountId(context)) return true
  return (context.pipelineSenders ?? []).some((s) => Boolean(s.missiveAccountId?.trim()))
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

/** Email drafts: try without account first, then with account if the alias was rejected. */
async function createAndSendEmailDraft(
  token: string,
  draft: MissiveDraftPayload,
  accountId?: string
): Promise<{ ok: true; data: unknown } | { ok: false; reason: string; senderMismatch: boolean }> {
  const { account: _existing, ...base } = draft
  const withoutAccount = await createAndSendDraft(token, base)
  if (withoutAccount.ok || !accountId) {
    return withoutAccount
  }
  if (!withoutAccount.senderMismatch) {
    return withoutAccount
  }

  const withAccount = await createAndSendDraft(token, { ...base, account: accountId })
  if (withAccount.ok) {
    return withAccount
  }
  if (isAccountNotFoundError(withAccount.reason)) {
    console.warn(
      `[missive] Account ${accountId} not visible to this API token for email send; alias must be in API available senders`
    )
  }
  return withoutAccount
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

  const fromAddress = context.fromAddress?.trim().toLowerCase()
  if (!fromAddress || !fromAddress.includes('@')) {
    return { ok: false, reason: 'Send-from address missing on outreach send' }
  }

  const vars: Record<string, string> = {
    creator_name: context.creatorName,
    contact_name: context.contactName,
    platform: context.platform ?? '',
    handle: context.handle ?? '',
  }

  const renderedSubject = replaceBookMeetingInPlainText(
    renderOutreachTemplate(template.subject, vars).trim(),
    context.bookingDetails
  )
  const renderedBody = renderOutreachTemplate(template.bodyPreview, vars).trim()
  const body = appendOutreachSignatureHtml(
    outreachBodyToEmailHtml(renderedBody, context.bookingDetails),
    context.signatureHtml
  )

  const existingConversationId = context.existingConversationId?.trim() || null
  const subject = existingConversationId
    ? replySubject(renderedSubject)
    : renderedSubject

  const teamId = process.env.MISSIVE_TEAM_ID?.trim()
  const organizationId = process.env.MISSIVE_ORGANIZATION_ID?.trim()
  const fromName =
    context.fromDisplayName?.trim() ||
    process.env.MISSIVE_FROM_NAME?.trim() ||
    undefined

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

  const configuredFrom = fromAddress.toLowerCase()
  const tokenOwnerEmail = await getMissiveTokenOwnerEmail(token)
  const sharedInbox = hasSharedInboxConfigured(context)
  const configuredAccountId = accountIdForAddress(context, configuredFrom)

  const candidates = sharedInbox
    ? [
        configuredFrom,
        ...(allowPersonalEmailFallback() && tokenOwnerEmail ? [tokenOwnerEmail] : []),
      ]
    : buildSendFromCandidates(fromAddress, [
        ...(context.pipelineSenders?.map((s) => s.address) ??
          context.fallbackFromAddresses ??
          []),
        tokenOwnerEmail ?? '',
      ])

  let lastReason = 'No send-from address available'
  let lastSenderMismatch = false
  const tried: string[] = []

  let sentData: unknown = null
  let usedFrom = configuredFrom
  let personalFallback = false

  for (const candidate of candidates) {
    tried.push(candidate)
    const useAccount =
      candidate === configuredFrom ? configuredAccountId : undefined
    const candidateName = displayNameForAddress(context, candidate, fromName)
    const fromField: { address: string; name?: string } = { address: candidate }
    if (candidateName) {
      fromField.name = candidateName
    }

    const created = await createAndSendEmailDraft(
      token,
      {
        ...baseDraft,
        from_field: fromField,
      },
      useAccount
    )

    if (created.ok) {
      sentData = created.data
      usedFrom = candidate
      personalFallback =
        candidate === tokenOwnerEmail?.toLowerCase() && candidate !== configuredFrom
      if (personalFallback) {
        console.warn(
          `[missive] Sent from ${candidate} (personal fallback). Configured sender ${configuredFrom} is not API-allowed yet.`
        )
      }
      break
    }

    lastReason = created.reason
    lastSenderMismatch = created.senderMismatch
    if (!created.senderMismatch) {
      return { ok: false, reason: created.reason }
    }
  }

  if (!sentData) {
    return {
      ok: false,
      reason: lastSenderMismatch
        ? senderMismatchHelp(fromAddress, tried, tokenOwnerEmail, configuredAccountId)
        : lastReason,
    }
  }

  let conversationId =
    conversationIdFromDraftResponse(sentData) ?? existingConversationId

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

  return {
    ok: true,
    conversationId,
    fromAddress: usedFrom,
    configuredFromAddress: configuredFrom,
    personalFallback,
  }
}

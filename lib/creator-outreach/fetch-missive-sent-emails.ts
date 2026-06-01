import { missiveApiRequest } from '@/lib/creator-outreach/missive'

export type MissiveSentEmail = {
  messageId: string
  conversationId: string
  subject: string
  preview: string
  deliveredAt: string
  fromLabel: string
  toLabel: string
  missiveWebUrl: string | null
}

export type MissiveEmailAttachment = {
  id: string
  filename: string
  url: string
  size: number | null
}

export type MissiveEmailDetail = MissiveSentEmail & {
  bodyHtml: string
  ccLabel: string
  bccLabel: string
  replyToLabel: string
  emailMessageId: string | null
  authorLabel: string | null
  attachments: MissiveEmailAttachment[]
}

type MissiveEmailField = { name?: string | null; address?: string | null }

type MissiveMessageRow = {
  id: string
  subject?: string | null
  preview?: string | null
  body?: string | null
  type?: string
  delivered_at?: number
  email_message_id?: string | null
  from_field?: MissiveEmailField
  to_fields?: MissiveEmailField[]
  cc_fields?: MissiveEmailField[]
  bcc_fields?: MissiveEmailField[]
  reply_to_fields?: MissiveEmailField[]
  attachments?: {
    id: string
    filename?: string
    url?: string
    size?: number
  }[]
  author?: { id?: string; name?: string; email?: string } | null
}

type MissiveConversationRow = {
  id: string
  web_url?: string | null
}

function formatAddressField(field?: MissiveEmailField): string {
  if (!field) return ''
  const address = field.address?.trim()
  if (!address) return field.name?.trim() ?? ''
  const name = field.name?.trim()
  return name ? `${name} <${address}>` : address
}

function formatRecipientList(fields?: MissiveEmailField[]): string {
  if (!fields?.length) return ''
  return fields.map(formatAddressField).filter(Boolean).join(', ')
}

function isOutgoingEmailMessage(message: MissiveMessageRow): boolean {
  if (message.type && message.type !== 'email' && message.type !== 'custom_email') {
    return false
  }
  return Boolean(message.author?.id)
}

function unixToIso(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return new Date().toISOString()
  return new Date(seconds * 1000).toISOString()
}

async function fetchConversationWebUrl(
  token: string,
  conversationId: string
): Promise<string | null> {
  const result = await missiveApiRequest<{ conversations?: MissiveConversationRow[] }>(
    token,
    `/conversations/${conversationId}`,
    { method: 'GET' }
  )
  if (!result.ok) return null
  const url = result.data.conversations?.[0]?.web_url
  return typeof url === 'string' && url.trim() ? url.trim() : null
}

async function fetchOutgoingMessagesForConversation(
  token: string,
  conversationId: string,
  webUrl: string | null
): Promise<MissiveSentEmail[]> {
  const result = await missiveApiRequest<{ messages?: MissiveMessageRow[] }>(
    token,
    `/conversations/${conversationId}/messages?limit=10`,
    { method: 'GET' }
  )
  if (!result.ok) return []

  const rows = (result.data.messages ?? []).filter(isOutgoingEmailMessage)
  return rows.map((message) => ({
    messageId: message.id,
    conversationId,
    subject: message.subject?.trim() || '(No subject)',
    preview: message.preview?.trim() || '',
    deliveredAt: unixToIso(message.delivered_at),
    fromLabel: formatAddressField(message.from_field) || 'Unknown sender',
    toLabel: formatRecipientList(message.to_fields) || '—',
    missiveWebUrl: webUrl,
  }))
}

/** Load outgoing email messages from Missive for the given conversation IDs. */
export async function fetchSentEmailsFromConversations(
  conversationIds: string[]
): Promise<{ emails: MissiveSentEmail[]; error?: string }> {
  const token = process.env.MISSIVE_API_TOKEN?.trim()
  if (!token) {
    return { emails: [], error: 'MISSIVE_API_TOKEN not configured' }
  }

  const uniqueIds = [...new Set(conversationIds.map((id) => id.trim()).filter(Boolean))]
  if (uniqueIds.length === 0) {
    return { emails: [] }
  }

  const webUrls = new Map<string, string | null>()
  await Promise.all(
    uniqueIds.map(async (id) => {
      webUrls.set(id, await fetchConversationWebUrl(token, id))
    })
  )

  const batches = await Promise.all(
    uniqueIds.map((id) =>
      fetchOutgoingMessagesForConversation(token, id, webUrls.get(id) ?? null)
    )
  )

  const emails = batches
    .flat()
    .sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt))

  return { emails }
}

function mapMessageToDetail(
  message: MissiveMessageRow,
  conversationId: string,
  webUrl: string | null
): MissiveEmailDetail {
  const author = message.author
  const authorLabel = author
    ? author.name?.trim() || author.email?.trim() || null
    : null

  return {
    messageId: message.id,
    conversationId,
    subject: message.subject?.trim() || '(No subject)',
    preview: message.preview?.trim() || '',
    deliveredAt: unixToIso(message.delivered_at),
    fromLabel: formatAddressField(message.from_field) || 'Unknown sender',
    toLabel: formatRecipientList(message.to_fields) || '—',
    missiveWebUrl: webUrl,
    bodyHtml: message.body?.trim() || '',
    ccLabel: formatRecipientList(message.cc_fields),
    bccLabel: formatRecipientList(message.bcc_fields),
    replyToLabel: formatRecipientList(message.reply_to_fields),
    emailMessageId: message.email_message_id?.trim() || null,
    authorLabel,
    attachments: (message.attachments ?? []).map((a) => ({
      id: a.id,
      filename: a.filename?.trim() || 'Attachment',
      url: a.url?.trim() || '',
      size: typeof a.size === 'number' ? a.size : null,
    })),
  }
}

/** Full message including HTML body (GET /v1/messages/:id). */
export async function fetchMissiveMessageDetail(
  messageId: string,
  conversationId: string,
  missiveWebUrl: string | null
): Promise<{ detail: MissiveEmailDetail | null; error?: string }> {
  const token = process.env.MISSIVE_API_TOKEN?.trim()
  if (!token) {
    return { detail: null, error: 'MISSIVE_API_TOKEN not configured' }
  }

  const result = await missiveApiRequest<{ messages?: MissiveMessageRow | MissiveMessageRow[] }>(
    token,
    `/messages/${encodeURIComponent(messageId.trim())}`,
    { method: 'GET' }
  )

  if (!result.ok) {
    return { detail: null, error: result.reason }
  }

  const raw = result.data.messages
  const message = Array.isArray(raw) ? raw[0] : raw
  if (!message?.id) {
    return { detail: null, error: 'Message not found' }
  }

  let webUrl = missiveWebUrl
  if (!webUrl) {
    webUrl = await fetchConversationWebUrl(token, conversationId)
  }

  return { detail: mapMessageToDetail(message, conversationId, webUrl) }
}

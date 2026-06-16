import { deriveCreatorCrmStatusFromContacts } from './crm-status'
import { resolveSendFromForRule } from './resolve-send-from'
import type {
  ActivityEventType,
  CreatorOutreachStore,
  EmailTemplate,
  OutreachRule,
  OutreachSend,
} from './types'
import { normalizeEmail } from './store'

export type ContactEmailReadyEvent = {
  contactId: string
}

export type EvaluateOutreachResult =
  | { action: 'queued'; send: OutreachSend }
  | { action: 'skipped'; reason: string }
  | { action: 'none'; reason: string }

function uid(): string {
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

function defaultTemplate(store: CreatorOutreachStore): EmailTemplate {
  return store.templates.find((t) => t.isDefault) ?? store.templates[0]
}

export function hasActiveOutreachForEmail(store: CreatorOutreachStore, email: string): boolean {
  const normalized = normalizeEmail(email)
  return store.outreachSends.some(
    (s) =>
      normalizeEmail(s.email) === normalized &&
      (s.status === 'sent' || s.status === 'queued')
  )
}

function ruleForContactKind(
  rules: OutreachRule[],
  contactKind: OutreachRule['contactKind']
): OutreachRule | undefined {
  return rules.find(
    (r) => r.enabled && r.trigger === 'contact_email_ready' && r.contactKind === contactKind
  )
}

/** Only after Missive successfully sends — not on queue, skip, or email scrape. */
function markContactCrmStatusAfterSuccessfulSend(
  store: CreatorOutreachStore,
  contactId: string | null
): void {
  if (!contactId) return
  const contact = store.contacts.find((c) => c.id === contactId)
  if (!contact) return
  if (contact.status !== 'new') return
  contact.status = 'contacted'
  if (contact.creatorId) {
    const creator = store.creators.find((c) => c.id === contact.creatorId)
    if (creator) {
      creator.status = deriveCreatorCrmStatusFromContacts(store, contact.creatorId)
    }
  }
}

function pushActivity(
  store: CreatorOutreachStore,
  type: ActivityEventType,
  message: string
): void {
  store.activity.unshift({
    id: uid(),
    type,
    message,
    createdAt: nowIso(),
  })
}

export function applyContactEmailReadyRules(
  store: CreatorOutreachStore,
  rules: OutreachRule[],
  event: ContactEmailReadyEvent
): EvaluateOutreachResult {
  const contact = store.contacts.find((c) => c.id === event.contactId)
  if (!contact) return { action: 'none', reason: 'Contact not found' }

  const normalized = normalizeEmail(contact.email)
  if (!normalized || !normalized.includes('@')) {
    return { action: 'none', reason: 'Invalid email' }
  }

  const rule = ruleForContactKind(rules, contact.kind)
  if (!rule) {
    return { action: 'none', reason: `No enabled rule for ${contact.kind}` }
  }

  if (rule.action === 'do_not_send') {
    pushActivity(
      store,
      'outreach_skipped',
      `Rule: do not send for ${contact.kind} (${normalized})`
    )
    return { action: 'none', reason: `Rule: do not send for ${contact.kind}` }
  }

  const sendFrom = resolveSendFromForRule(store, rule)
  if (!sendFrom) {
    return { action: 'none', reason: 'No enabled send-from address configured' }
  }

  if (hasActiveOutreachForEmail(store, normalized)) {
    const tpl =
      store.templates.find((t) => t.id === rule.templateId) ?? defaultTemplate(store)
    const skipped: OutreachSend = {
      id: uid(),
      email: normalized,
      templateId: tpl.id,
      templateName: tpl.name,
      fromAddress: sendFrom.address,
      fromDisplayName: sendFrom.displayName,
      profileId: null,
      contactId: contact.id,
      creatorId: contact.creatorId,
      status: 'skipped_duplicate',
      sentAt: nowIso(),
    }
    store.outreachSends.unshift(skipped)
    pushActivity(
      store,
      'outreach_skipped',
      `Skipped outreach — already queued or sent to ${normalized}`
    )
    return { action: 'skipped', reason: 'Email already has outreach queued or sent' }
  }

  const tpl =
    store.templates.find((t) => t.id === rule.templateId) ?? defaultTemplate(store)

  const send: OutreachSend = {
    id: uid(),
    email: normalized,
    templateId: tpl.id,
    templateName: tpl.name,
    fromAddress: sendFrom.address,
    fromDisplayName: sendFrom.displayName,
    profileId: null,
    contactId: contact.id,
    creatorId: contact.creatorId,
    status: 'queued',
    sentAt: nowIso(),
  }
  store.outreachSends.unshift(send)
  pushActivity(
    store,
    'outreach_queued',
    `Queued "${tpl.name}" from ${sendFrom.address} to ${normalized} (${contact.kind})`
  )
  return { action: 'queued', send }
}

/** After Missive delivers a queued send — update store rows and activity. */
export function markOutreachSendDelivered(
  store: CreatorOutreachStore,
  send: OutreachSend,
  conversationId: string,
  contact: CreatorOutreachStore['contacts'][number] | null
): void {
  send.status = 'sent'
  if (contact && !contact.missiveConversationIds.includes(conversationId)) {
    contact.missiveConversationIds.push(conversationId)
  }
  pushActivity(
    store,
    'outreach_sent',
    `Sent "${send.templateName}" to ${send.email} via Missive`
  )
  markContactCrmStatusAfterSuccessfulSend(store, send.contactId)
}

export function detectContactEmailReadyEvents(
  previous: CreatorOutreachStore,
  next: CreatorOutreachStore
): ContactEmailReadyEvent[] {
  const events: ContactEmailReadyEvent[] = []
  const prevById = new Map(previous.contacts.map((c) => [c.id, c]))

  for (const contact of next.contacts) {
    const prev = prevById.get(contact.id)
    const email = normalizeEmail(contact.email)
    if (!email || !email.includes('@')) continue

    if (!prev) {
      events.push({ contactId: contact.id })
      continue
    }

    const prevEmail = normalizeEmail(prev.email)
    if (!prevEmail || prevEmail !== email) {
      events.push({ contactId: contact.id })
    }
  }

  return events
}

export function runContactEmailReadyRules(
  store: CreatorOutreachStore,
  rules: OutreachRule[],
  events: ContactEmailReadyEvent[]
): EvaluateOutreachResult | undefined {
  let last: EvaluateOutreachResult | undefined
  for (const event of events) {
    last = applyContactEmailReadyRules(store, rules, event)
  }
  return last
}

import { normalizeEmail } from '@/lib/creator-outreach/store'
import type { MissiveConversation } from './types'

function addEmail(set: Set<string>, raw: string | null | undefined) {
  const trimmed = raw?.trim()
  if (!trimmed) return
  set.add(normalizeEmail(trimmed))
}

/** Participant addresses from the latest message in a Missive conversation. */
export function extractParticipantEmails(conversation: MissiveConversation): string[] {
  const emails = new Set<string>()
  const message = conversation.latest_message
  if (!message) return []

  addEmail(emails, message.from_field?.address)
  for (const field of message.to_fields ?? []) {
    addEmail(emails, field.address)
  }
  for (const field of message.cc_fields ?? []) {
    addEmail(emails, field.address)
  }

  return [...emails]
}

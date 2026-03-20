/** Shared types and placeholder metadata (no server deps — safe for client) */

export interface NotificationContentTemplate {
  notification_type: string
  title_template: string
  body_template: string
  updated_at: string
}

export const NOTIFICATION_PLACEHOLDERS: Record<string, string> = {
  sender_name: "Sender's name (or username, or \"Someone\")",
  recipient_name: "Recipient's name (e.g. who accepted the request)",
  message_preview: 'Truncated message text or "📷 Sent you a photo"',
  status_title: 'Short status line for the push title (e.g. emoji + label)',
  status_message: 'Human-readable status detail for the body',
  subject: 'Support ticket subject (truncated in production)',
}

/** Placeholders per notification type for UI hint */
export const PLACEHOLDERS_BY_TYPE: Record<string, string[]> = {
  friend_request: ['sender_name'],
  friend_request_accepted: ['recipient_name'],
  message: ['sender_name', 'message_preview'],
  refund_request_status: ['status_title', 'status_message'],
  report_status: ['status_title', 'status_message'],
  support_ticket_status: ['status_title', 'status_message', 'subject'],
}

/** Types where test push needs a second user (sender / accepter) for name placeholders. */
const NOTIFICATION_TYPES_NEEDING_CONTEXT_USER = new Set([
  'friend_request',
  'friend_request_accepted',
  'message',
])

/** Test push needs a second profile for template placeholders (sender, accepter, etc.). */
export function notificationTestNeedsContextUser(notificationType: string): boolean {
  return NOTIFICATION_TYPES_NEEDING_CONTEXT_USER.has(notificationType)
}

/** Short label for the “other” user in the test-push modal */
export const TEST_PUSH_CONTEXT_USER_LABEL: Record<string, string> = {
  friend_request: 'Other user (sender of the request)',
  friend_request_accepted: 'Other user (who accepted — name in the notification)',
  message: 'Other user (message sender)',
}

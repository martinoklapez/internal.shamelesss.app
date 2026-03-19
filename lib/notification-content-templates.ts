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
}

/** Placeholders per notification type for UI hint */
export const PLACEHOLDERS_BY_TYPE: Record<string, string[]> = {
  friend_request: ['sender_name'],
  friend_request_accepted: ['recipient_name'],
  message: ['sender_name', 'message_preview'],
}

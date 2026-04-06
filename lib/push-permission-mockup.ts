/**
 * Push permission onboarding mockup: maps notification_content_templates types to
 * avatar vs app-icon layout, and substitutes template placeholders for preview/save.
 */

export type PushTemplateSource = 'notification_template' | 'custom'
export type PushMockupType = 'user-avatar' | 'app-icon'

/** Left-side icon style per notification_type (from notification_content_templates). */
const NOTIFICATION_TYPE_MOCKUP: Record<string, PushMockupType> = {
  friend_request: 'user-avatar',
  friend_request_accepted: 'user-avatar',
  message: 'user-avatar',
  refund_request_status: 'app-icon',
  report_status: 'app-icon',
  support_ticket_status: 'app-icon',
  reengagement_paywall: 'app-icon',
}

export function getMockupTypeForNotificationType(notificationType: string): PushMockupType {
  return NOTIFICATION_TYPE_MOCKUP[notificationType] ?? 'app-icon'
}

const SAMPLE_MESSAGE_PREVIEW = 'Hey, want to grab coffee tomorrow?'

/** Preview / final strings: replace {sender_name}, {name}, {message_preview}, etc. */
export function substitutePushMockupPlaceholders(
  template: string,
  vars: { displayName: string; messagePreview?: string }
): string {
  const d = vars.displayName.trim() || 'Someone'
  const mp = vars.messagePreview?.trim() || SAMPLE_MESSAGE_PREVIEW
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const k = key.toLowerCase()
    if (k === 'name' || k === 'sender_name' || k === 'recipient_name') return d
    if (k === 'message_preview') return mp
    if (k === 'status_title') return 'Update'
    if (k === 'status_message') return 'Tap to view details'
    if (k === 'subject') return 'Support'
    return `{${key}}`
  })
}

export function finalizePushMockupForSave(
  title: string,
  body: string,
  displayName: string,
  messagePreview?: string
): { title: string; body: string } {
  const v = { displayName, messagePreview }
  return {
    title: substitutePushMockupPlaceholders(title, v),
    body: substitutePushMockupPlaceholders(body, v),
  }
}

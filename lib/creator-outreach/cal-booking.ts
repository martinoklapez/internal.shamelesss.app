import type { SendFromAddress } from './types'

export const BOOK_MEETING_PLACEHOLDER = 'book_meeting'
export const BOOK_MEETING_TOKEN = `{{${BOOK_MEETING_PLACEHOLDER}}}`

export type CalBookingMeetingDetails = {
  url?: string
  meetingName: string
  meetingType: string
  duration: string
  actionLabel: string
  hostName?: string
  hostAvatarUrl?: string
}

const DEFAULT_MEETING_DETAILS = {
  meetingName: 'Intro call',
  meetingType: 'Video call',
  duration: '30 min',
  actionLabel: 'Pick a time',
} as const

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function normalizeBookingUrl(url?: string): string | undefined {
  if (!url?.trim()) return undefined
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return undefined
  }
}

function meetingNameFromCalUrl(url: string): string | undefined {
  try {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop()
    if (!slug) return undefined
    return slug
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  } catch {
    return undefined
  }
}

export function hostInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export function normalizeHostAvatarUrl(url?: string): string | undefined {
  if (!url?.trim()) return undefined
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'https:') return undefined
    return parsed.toString()
  } catch {
    return undefined
  }
}

export function resolveCalBookingMeetingDetails(
  input?: Partial<CalBookingMeetingDetails>
): CalBookingMeetingDetails {
  const url = normalizeBookingUrl(input?.url)
  const meetingName =
    input?.meetingName?.trim() ||
    (url ? meetingNameFromCalUrl(url) : undefined) ||
    DEFAULT_MEETING_DETAILS.meetingName

  return {
    url,
    meetingName,
    meetingType:
      input?.meetingType?.trim() || DEFAULT_MEETING_DETAILS.meetingType,
    duration: input?.duration?.trim() || DEFAULT_MEETING_DETAILS.duration,
    actionLabel:
      input?.actionLabel?.trim() || DEFAULT_MEETING_DETAILS.actionLabel,
    hostName: input?.hostName?.trim() || undefined,
    hostAvatarUrl: normalizeHostAvatarUrl(input?.hostAvatarUrl),
  }
}

export function bookingDetailsFromSender(
  sender: Pick<
    SendFromAddress,
    | 'displayName'
    | 'hostAvatarUrl'
    | 'bookingUrl'
    | 'bookingMeetingName'
    | 'bookingMeetingType'
    | 'bookingDuration'
    | 'bookingActionLabel'
  >
): CalBookingMeetingDetails {
  return resolveCalBookingMeetingDetails({
    url: sender.bookingUrl,
    meetingName: sender.bookingMeetingName,
    meetingType: sender.bookingMeetingType,
    duration: sender.bookingDuration,
    actionLabel: sender.bookingActionLabel,
    hostName: sender.displayName,
    hostAvatarUrl: sender.hostAvatarUrl,
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function emailAvatarHtml(details: CalBookingMeetingDetails): string {
  const hostName = details.hostName?.trim() || 'Host'
  const safeName = escapeHtml(hostName)
  const avatarUrl = normalizeHostAvatarUrl(details.hostAvatarUrl)

  if (avatarUrl) {
    const safeUrl = avatarUrl.replace(/"/g, '&quot;')
    return `<img src="${safeUrl}" width="40" height="40" alt="${safeName}" style="display:block;width:40px;height:40px;border-radius:9999px;object-fit:cover;border:1px solid #e5e7eb;background:#f3f4f6;" />`
  }

  const initials = escapeHtml(hostInitials(hostName))
  return `<div style="width:40px;height:40px;border-radius:9999px;background:#f3f4f6;border:1px solid #e5e7eb;text-align:center;line-height:40px;font-size:12px;font-weight:500;color:#4b5563;">${initials}</div>`
}

function buildCalBookingCardInnerHtml(details: CalBookingMeetingDetails): string {
  const meetingName = escapeHtml(details.meetingName)
  const meta = escapeHtml(`${details.meetingType} · ${details.duration}`)
  const actionLabel = escapeHtml(details.actionLabel)
  const hostLine = details.hostName?.trim()
    ? escapeHtml(`Call with ${details.hostName.trim()}`)
    : 'Schedule a call'
  const avatar = emailAvatarHtml(details)

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:0;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;font-family:${FONT_STACK};">
<tr>
<td style="padding:16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td width="40" valign="top" style="width:40px;padding-right:12px;">${avatar}</td>
<td valign="top">
<div style="font-size:11px;line-height:1.4;color:#6b7280;">${hostLine}</div>
<div style="margin-top:3px;font-size:14px;font-weight:500;line-height:1.4;color:#111827;">${meetingName}</div>
<div style="margin-top:4px;font-size:12px;line-height:1.4;color:#9ca3af;">${meta}</div>
</td>
</tr>
</table>
<div style="margin-top:12px;padding-top:12px;border-top:1px solid #f3f4f6;font-size:12px;font-weight:500;line-height:1.4;color:#374151;">${actionLabel} &rarr;</div>
</td>
</tr>
</table>`
}

/** Email-safe bordered card linking to Cal.com (or any booking URL). */
export function buildCalBookingWidgetHtml(
  details: CalBookingMeetingDetails
): string {
  const card = buildCalBookingCardInnerHtml(details)

  if (!details.url?.trim()) {
    return `<div style="margin:20px 0;max-width:340px;">${card}</div>`
  }

  const href = details.url.replace(/"/g, '&quot;')
  return `<div style="margin:20px 0;max-width:340px;"><a href="${href}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;color:inherit;">${card}</a></div>`
}

export function replaceBookMeetingInPlainText(
  text: string,
  details?: Partial<CalBookingMeetingDetails>
): string {
  if (!text.includes(BOOK_MEETING_TOKEN)) return text
  const meeting = resolveCalBookingMeetingDetails(details)
  const host = meeting.hostName ? ` with ${meeting.hostName}` : ''
  const replacement = meeting.url
    ? `${meeting.meetingName}${host} (${meeting.meetingType}, ${meeting.duration}): ${meeting.url}`
    : meeting.meetingName
  return text.split(BOOK_MEETING_TOKEN).join(replacement)
}

/**
 * Convert outreach body (plain text + {{book_meeting}}) to Missive HTML.
 * Text paragraphs use the standard converter; the widget is injected as HTML.
 */
export function outreachBodyToEmailHtml(
  body: string,
  options?: Partial<CalBookingMeetingDetails>
): string {
  const trimmed = body.trim()
  if (!trimmed) return '<div><br></div>'
  if (!trimmed.includes(BOOK_MEETING_TOKEN)) {
    return textToMissiveHtml(trimmed)
  }

  const widgetHtml = buildCalBookingWidgetHtml(resolveCalBookingMeetingDetails(options))
  const parts = trimmed.split(BOOK_MEETING_TOKEN)
  return parts
    .map((part) => textToMissiveHtml(part))
    .join(widgetHtml)
}

function textToMissiveHtml(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed
  return trimmed
    .split(/\n\n+/)
    .map((paragraph) => {
      const inner = escapeHtml(paragraph).replace(/\n/g, '<br>')
      return `<div>${inner}</div>`
    })
    .join('<div><br></div>')
}

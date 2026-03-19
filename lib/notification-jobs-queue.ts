/**
 * Insert test rows into notification_jobs matching production (triggers normally create these;
 * admin tests insert directly with the same shape the Edge Function expects).
 *
 * Schema reference:
 *   user_id, notification_type, title (text), body (text), data (jsonb), status, ...
 *
 * Env overrides if needed:
 * - NOTIFICATION_JOBS_SCHEMA, NOTIFICATION_JOBS_TABLE
 * - NOTIFICATION_JOBS_STATUS_COLUMN, NOTIFICATION_JOBS_PENDING_STATUS
 * - NOTIFICATION_JOBS_RECIPIENT_COLUMN (default user_id)
 * - NOTIFICATION_JOBS_TYPE_COLUMN (default notification_type)
 * - NOTIFICATION_JOBS_TITLE_COLUMN (default title)
 * - NOTIFICATION_JOBS_TEXT_BODY_COLUMN (default body) — human-readable notification body TEXT
 * - NOTIFICATION_JOBS_DATA_COLUMN (default data) — jsonb payload
 *
 * NOTIFICATION_TEST_SKIP_INVOKE=true — only insert; cron invokes the worker.
 */

import { randomUUID } from 'crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

export type NotificationJobProfileRow = {
  user_id: string
  name: string | null
  username: string | null
  profile_picture_url: string | null
}

function envOr(name: string, fallback: string): string {
  const v = process.env[name]?.trim()
  return v && v.length > 0 ? v : fallback
}

export function displayNameForJob(p: NotificationJobProfileRow | undefined): string {
  if (!p) return 'Someone'
  if (p.name?.trim()) return p.name.trim()
  if (p.username?.trim()) return `@${p.username.trim()}`
  return 'Someone'
}

/** Match production samples: storage path under bucket, e.g. profiles/abc.jpg */
export function profilePathForNotificationData(url: string | null | undefined): string {
  if (!url || !url.trim()) return ''
  const u = url.trim()
  const marker = '/object/public/'
  const i = u.indexOf(marker)
  if (i >= 0) return u.slice(i + marker.length)
  return u
}

export function applyNotificationTextTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)
}

/** Default title/body TEXT when no row in notification_content_templates */
export const NOTIFICATION_JOB_TEXT_DEFAULTS: Record<
  string,
  { title: string; body: string }
> = {
  friend_request: {
    title: '✨ New Friend Request',
    body: '{sender_name} wants to connect!',
  },
  friend_request_accepted: {
    title: "🎉 You're now friends!",
    body: '{recipient_name} accepted your request - start chatting!',
  },
  message: {
    title: '{sender_name}',
    body: '{message_preview}',
  },
  refund_request_status: {
    title: '✅ Refund Request Approved',
    body: 'Your refund request has been approved',
  },
  report_status: {
    title: '✅ Report Resolved',
    body: 'Your report has been resolved',
  },
  support_ticket_status: {
    title: '✅ Support Ticket Resolved',
    body: 'Your support ticket has been resolved',
  },
}

const REFUND_STATUS_COPY: Record<string, { title: string; body: string }> = {
  approved: {
    title: '✅ Refund Request Approved',
    body: 'Your refund request has been approved',
  },
  rejected: {
    title: 'Refund Request Update',
    body: 'Your refund request was rejected',
  },
  processed: {
    title: 'Refund processed',
    body: 'Your refund has been processed',
  },
}

const REPORT_STATUS_COPY: Record<string, { title: string; body: string }> = {
  resolved: {
    title: '✅ Report Resolved',
    body: 'Your report has been resolved',
  },
  dismissed: {
    title: 'Report dismissed',
    body: 'Your report has been dismissed',
  },
}

const SUPPORT_STATUS_COPY: Record<string, { title: string; body: string }> = {
  resolved: {
    title: '✅ Support Ticket Resolved',
    body: 'Your support ticket has been resolved',
  },
  in_progress: {
    title: 'Support ticket update',
    body: 'Your support ticket is in progress',
  },
  closed: {
    title: 'Support ticket closed',
    body: 'Your support ticket has been closed',
  },
}

/**
 * jsonb `data` column — same keys as trigger-created jobs (synthetic UUIDs for admin tests).
 */
export function buildNotificationJobData(params: {
  notificationType: string
  recipientUserId: string
  contextUserId?: string
  profilesByUserId: Map<string, NotificationJobProfileRow>
  /** message body text; image-style body often uses 📷 line without changing data */
  testMessagePreview?: string
  /** refund_request_status */
  refundStatus?: string
  /** report_status */
  reportStatus?: string
  /** support_ticket_status */
  supportStatus?: string
  /** optional real connection UUID for message tests */
  testConnectionId?: string
}): Record<string, unknown> {
  const {
    notificationType,
    recipientUserId,
    contextUserId,
    profilesByUserId,
    testConnectionId,
  } = params
  const recipient = profilesByUserId.get(recipientUserId)
  const context = contextUserId ? profilesByUserId.get(contextUserId) : undefined

  if (notificationType === 'friend_request') {
    const senderId = contextUserId ?? recipientUserId
    const senderProfile = context ?? recipient
    const pic = profilePathForNotificationData(senderProfile?.profile_picture_url)
    return {
      requestId: randomUUID(),
      fromUserId: senderId,
      senderId,
      senderName: displayNameForJob(senderProfile),
      senderProfilePictureUrl: pic,
      action: 'view_request',
    }
  }

  if (notificationType === 'friend_request_accepted') {
    const accepterId = contextUserId ?? recipientUserId
    const accepterProfile = context ?? recipient
    const pic = profilePathForNotificationData(accepterProfile?.profile_picture_url)
    return {
      requestId: randomUUID(),
      senderId: accepterId,
      senderName: displayNameForJob(accepterProfile),
      senderProfilePictureUrl: pic,
      action: 'view_chat',
    }
  }

  if (notificationType === 'message') {
    const senderId = contextUserId ?? recipientUserId
    const senderProfile = context ?? recipient
    const pic = profilePathForNotificationData(senderProfile?.profile_picture_url)
    return {
      messageId: randomUUID(),
      connectionId: testConnectionId?.trim() || randomUUID(),
      senderId,
      senderProfilePictureUrl: pic,
      action: 'view_chat',
    }
  }

  if (notificationType === 'refund_request_status') {
    const st = (params.refundStatus ?? 'approved').toLowerCase()
    return {
      requestId: randomUUID(),
      status: st,
      action: 'view_refund',
    }
  }

  if (notificationType === 'report_status') {
    const st = (params.reportStatus ?? 'resolved').toLowerCase()
    return {
      reportId: randomUUID(),
      status: st,
      action: 'view_report',
    }
  }

  if (notificationType === 'support_ticket_status') {
    const st = (params.supportStatus ?? 'resolved').toLowerCase()
    return {
      ticketId: randomUUID(),
      status: st,
      action: 'view_support',
    }
  }

  return {
    recipient_user_id: recipientUserId,
    admin_panel_test: true,
  }
}

/** Resolve title + body TEXT using DB templates or defaults + placeholder vars */
export function buildTestJobTitleAndBody(params: {
  notificationType: string
  titleTemplate: string | null | undefined
  bodyTemplate: string | null | undefined
  vars: Record<string, string>
  refundStatus?: string
  reportStatus?: string
  supportStatus?: string
}): { title: string; bodyText: string } {
  const { notificationType, titleTemplate, bodyTemplate, vars } = params
  const type = notificationType.trim()

  let defaults = NOTIFICATION_JOB_TEXT_DEFAULTS[type]
  if (type === 'refund_request_status') {
    const st = (params.refundStatus ?? 'approved').toLowerCase()
    defaults = REFUND_STATUS_COPY[st] ?? REFUND_STATUS_COPY.approved
  } else if (type === 'report_status') {
    const st = (params.reportStatus ?? 'resolved').toLowerCase()
    defaults = REPORT_STATUS_COPY[st] ?? REPORT_STATUS_COPY.resolved
  } else if (type === 'support_ticket_status') {
    const st = (params.supportStatus ?? 'resolved').toLowerCase()
    defaults = SUPPORT_STATUS_COPY[st] ?? SUPPORT_STATUS_COPY.resolved
  }
  if (!defaults) {
    defaults = {
      title: `Test: ${type}`,
      body: 'Admin test notification',
    }
  }

  const rawTitle = titleTemplate?.trim() ? titleTemplate : defaults.title
  const rawBody = bodyTemplate?.trim() ? bodyTemplate : defaults.body

  return {
    title: applyNotificationTextTemplate(rawTitle, vars),
    bodyText: applyNotificationTextTemplate(rawBody, vars),
  }
}

export type EnqueueNotificationJobResult =
  | { ok: true; jobId: string | null }
  | {
      ok: false
      error: string
      code?: string
      details?: string
      hint?: string
      debug?: { schema: string; table: string; columns: string[] }
    }

function pgError(e: { message: string; code?: string; details?: string; hint?: string }) {
  return {
    error: e.message,
    code: e.code,
    details: e.details,
    hint: e.hint,
  }
}

export async function enqueuePendingNotificationJob(
  admin: SupabaseClient,
  params: {
    recipientUserId: string
    notificationType: string
    title: string
    bodyText: string
    data: Record<string, unknown>
  }
): Promise<EnqueueNotificationJobResult> {
  const schema = envOr('NOTIFICATION_JOBS_SCHEMA', 'public')
  const table = envOr('NOTIFICATION_JOBS_TABLE', 'notification_jobs')
  const statusCol = envOr('NOTIFICATION_JOBS_STATUS_COLUMN', 'status')
  const pendingStatus = envOr('NOTIFICATION_JOBS_PENDING_STATUS', 'pending')
  const recipientCol = envOr('NOTIFICATION_JOBS_RECIPIENT_COLUMN', 'user_id')
  const typeCol = envOr('NOTIFICATION_JOBS_TYPE_COLUMN', 'notification_type')
  const titleCol = envOr('NOTIFICATION_JOBS_TITLE_COLUMN', 'title')
  const textBodyCol = envOr('NOTIFICATION_JOBS_TEXT_BODY_COLUMN', 'body')
  const dataCol = envOr('NOTIFICATION_JOBS_DATA_COLUMN', 'data')

  const row: Record<string, unknown> = {
    [statusCol]: pendingStatus,
    [recipientCol]: params.recipientUserId,
    [typeCol]: params.notificationType,
    [titleCol]: params.title,
    [textBodyCol]: params.bodyText,
    [dataCol]: params.data,
  }

  const query =
    schema === 'public' ? admin.from(table) : admin.schema(schema).from(table)

  const firstAttempt = await query.insert(row).select('id')
  const error = firstAttempt.error
  const insertPayload = firstAttempt.data as { id?: unknown }[] | null

  const debugColumns = [
    statusCol,
    recipientCol,
    typeCol,
    titleCol,
    textBodyCol,
    dataCol,
  ]

  if (error) {
    const noIdColumn =
      /column\s+\"?id\"?\s+does not exist/i.test(error.message) ||
      error.code === '42703'
    if (noIdColumn) {
      const second = await query.insert(row)
      if (second.error) {
        return {
          ok: false,
          ...pgError(second.error),
          debug: { schema, table, columns: debugColumns },
        }
      }
      return { ok: true, jobId: null }
    }
    return {
      ok: false,
      ...pgError(error),
      debug: { schema, table, columns: debugColumns },
    }
  }

  const first = Array.isArray(insertPayload) ? insertPayload[0] : null
  const jobId =
    first && typeof first === 'object' && 'id' in first && first.id != null
      ? String(first.id)
      : null

  return { ok: true, jobId }
}

export async function invokeNotificationWorker(
  admin: SupabaseClient,
  functionName = 'send-push-notifications'
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await admin.functions.invoke(functionName, {
    body: {},
  })
  if (error) {
    return { ok: false, error: error.message }
  }
  void data
  return { ok: true }
}

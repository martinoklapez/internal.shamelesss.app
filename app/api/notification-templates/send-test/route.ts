import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserRole } from '@/lib/user-roles'
import {
  buildNotificationJobData,
  buildTestJobTitleAndBody,
  displayNameForJob,
  enqueuePendingNotificationJob,
  invokeNotificationWorker,
} from '@/lib/notification-jobs-queue'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = await getUserRole(user.id)
    if (role !== 'admin' && role !== 'dev' && role !== 'developer') {
      return NextResponse.json(
        { error: 'Only admin or developer can send test notifications' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      user_id,
      notification_type,
      context_user_id,
      test_message_preview,
      test_refund_status,
      test_report_status,
      test_support_status,
      test_connection_id,
    } = body as {
      user_id?: string
      notification_type?: string
      context_user_id?: string
      test_message_preview?: string
      test_refund_status?: string
      test_report_status?: string
      test_support_status?: string
      test_connection_id?: string
    }

    if (!user_id || !notification_type) {
      return NextResponse.json(
        { error: 'user_id and notification_type are required' },
        { status: 400 }
      )
    }

    if (
      context_user_id != null &&
      context_user_id !== '' &&
      context_user_id === user_id
    ) {
      return NextResponse.json(
        { error: 'context_user_id must differ from user_id (recipient vs other party)' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY required to enqueue jobs)' },
        { status: 503 }
      )
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey)
    const typeTrim = notification_type.trim()

    const profileIds = [user_id, context_user_id].filter(
      (id): id is string => typeof id === 'string' && id.length > 0
    )
    const uniqueIds = [...new Set(profileIds)]

    const { data: profileRows, error: profilesError } = await admin
      .from('profiles')
      .select('user_id, name, username, profile_picture_url')
      .in('user_id', uniqueIds)

    if (profilesError) {
      console.error('send-test: profiles fetch', profilesError)
      return NextResponse.json(
        { error: `Could not load profiles: ${profilesError.message}` },
        { status: 500 }
      )
    }

    const profilesByUserId = new Map(
      (profileRows ?? []).map((p) => [
        p.user_id,
        p as {
          user_id: string
          name: string | null
          username: string | null
          profile_picture_url: string | null
        },
      ])
    )

    const recipientProfile = profilesByUserId.get(user_id)
    const contextId =
      context_user_id != null && String(context_user_id).trim() !== ''
        ? String(context_user_id).trim()
        : undefined
    const contextProfile = contextId ? profilesByUserId.get(contextId) : undefined

    const preview = test_message_preview?.trim() || 'Hey, want to grab coffee tomorrow?'

    const vars: Record<string, string> = {
      sender_name: displayNameForJob(contextProfile ?? recipientProfile),
      recipient_name: displayNameForJob(contextProfile ?? recipientProfile),
      message_preview: preview,
    }

    const { data: tmpl } = await admin
      .from('notification_content_templates')
      .select('title_template, body_template')
      .eq('notification_type', typeTrim)
      .maybeSingle()

    const { title, bodyText } = buildTestJobTitleAndBody({
      notificationType: typeTrim,
      titleTemplate: tmpl?.title_template,
      bodyTemplate: tmpl?.body_template,
      vars,
      refundStatus: test_refund_status,
      reportStatus: test_report_status,
      supportStatus: test_support_status,
    })

    const dataPayload = buildNotificationJobData({
      notificationType: typeTrim,
      recipientUserId: user_id,
      contextUserId: contextId,
      profilesByUserId,
      testMessagePreview: preview,
      refundStatus: test_refund_status,
      reportStatus: test_report_status,
      supportStatus: test_support_status,
      testConnectionId: test_connection_id,
    })

    const enqueued = await enqueuePendingNotificationJob(admin, {
      recipientUserId: user_id,
      notificationType: typeTrim,
      title,
      bodyText,
      data: dataPayload,
    })

    if (!enqueued.ok) {
      console.error('send-test: enqueue failed', enqueued)
      return NextResponse.json(
        {
          error: enqueued.error,
          code: enqueued.code,
          details: enqueued.details,
          hint:
            enqueued.hint ??
            'Insert failed. Ensure columns match: title + body (text) + data (jsonb). Set NOTIFICATION_JOBS_* env vars if names differ.',
          debug: enqueued.debug,
        },
        { status: 502 }
      )
    }

    let invokeNote: string | undefined
    let pushDeliveryFailed = false
    let pushFailureMessage: string | undefined

    if (process.env.NOTIFICATION_TEST_SKIP_INVOKE !== 'true') {
      const invoked = await invokeNotificationWorker(admin)
      if (!invoked.ok) {
        pushDeliveryFailed = true
        pushFailureMessage = invoked.displayMessage
        invokeNote = `Invoking send-push-notifications failed: ${invoked.error}`
      } else if (invoked.note) {
        invokeNote = invoked.note
      }
    }

    return NextResponse.json({
      success: true,
      message:
        pushDeliveryFailed && pushFailureMessage
          ? 'Job queued — push could not be delivered.'
          : invokeNote ?? 'Test notification job queued and worker invoked.',
      job_id: enqueued.jobId ?? undefined,
      warning: pushDeliveryFailed ? undefined : invokeNote,
      push_delivery_failed: pushDeliveryFailed,
      push_failure_message: pushFailureMessage,
    })
  } catch (err) {
    console.error('Send test push:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

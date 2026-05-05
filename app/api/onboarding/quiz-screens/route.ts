import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserRole } from '@/lib/user-roles'
import { isAllowedQuizComponent, QUIZ_COMPONENT_IDS } from '@/lib/onboarding-component-ids'
import { validatePushNotificationPermissionOptions } from '@/lib/push-notification-permission-options'

function getAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Service role key is not configured')
  }
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = await getUserRole(user.id)
    const allowedRoles = ['admin', 'dev', 'developer']
    if (!userRole || !allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminSupabase = getAdminClient()
    const { data, error } = await adminSupabase
      .from('quiz_screens_staging')
      .select('*')
      .order('order_position', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('Error fetching quiz screens:', error)
      return NextResponse.json(
        { error: `Failed to fetch quiz screens: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ screens: data || [] }, { status: 200 })
  } catch (error: any) {
    console.error('Error in quiz screens route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = await getUserRole(user.id)
    const allowedRoles = ['admin', 'dev', 'developer']
    if (!userRole || !allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, options, order_position, event_name, should_show, component_id } = body

    if (component_id != null && component_id !== '' && !isAllowedQuizComponent(component_id)) {
      return NextResponse.json(
        {
          error: `component_id "${component_id}" is not allowed for quiz screens (conversion-only components such as country_select and gender_select belong in the conversion funnel). Allowed: ${QUIZ_COMPONENT_IDS.join(', ')}.`,
        },
        { status: 400 }
      )
    }

    let optionsPayload: unknown = options ?? null
    if (component_id === 'push_notification_permission') {
      const v = validatePushNotificationPermissionOptions(options ?? {})
      if (!v.ok) {
        return NextResponse.json({ error: v.error }, { status: 400 })
      }
      optionsPayload = v.value
    }

    const adminSupabase = getAdminClient()
    const { data, error } = await adminSupabase
      .from('quiz_screens_staging')
      .insert({
        title: title || null,
        description: description || null,
        options: optionsPayload,
        order_position: order_position || null,
        event_name: event_name || null,
        should_show: should_show ?? true,
        component_id: component_id || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating quiz screen:', error)
      return NextResponse.json(
        { error: `Failed to create quiz screen: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ screen: data }, { status: 201 })
  } catch (error: any) {
    console.error('Error in create quiz screen route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = await getUserRole(user.id)
    const allowedRoles = ['admin', 'dev', 'developer']
    if (!userRole || !allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, title, description, options, order_position, event_name, should_show, component_id } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    if (component_id != null && component_id !== '' && !isAllowedQuizComponent(component_id)) {
      return NextResponse.json(
        {
          error: `component_id "${component_id}" is not allowed for quiz screens (conversion-only components such as country_select and gender_select belong in the conversion funnel). Allowed: ${QUIZ_COMPONENT_IDS.join(', ')}.`,
        },
        { status: 400 }
      )
    }

    let optionsUpdateValue: unknown = null
    if (options !== undefined) {
      if (body.component_id === 'push_notification_permission') {
        const v = validatePushNotificationPermissionOptions(options)
        if (!v.ok) {
          return NextResponse.json({ error: v.error }, { status: 400 })
        }
        optionsUpdateValue = v.value
      } else {
        optionsUpdateValue = options
      }
    }

    const adminSupabase = getAdminClient()
    const { data, error } = await adminSupabase
      .from('quiz_screens_staging')
      .update({
        title: title !== undefined ? title : null,
        description: description !== undefined ? description : null,
        options: options !== undefined ? optionsUpdateValue : null,
        order_position: order_position !== undefined ? order_position : null,
        event_name: event_name !== undefined ? event_name : null,
        should_show: should_show !== undefined ? should_show : null,
        component_id: component_id !== undefined ? component_id : null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating quiz screen:', error)
      return NextResponse.json(
        { error: `Failed to update quiz screen: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ screen: data }, { status: 200 })
  } catch (error: any) {
    console.error('Error in update quiz screen route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = await getUserRole(user.id)
    const allowedRoles = ['admin', 'dev', 'developer']
    if (!userRole || !allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const adminSupabase = getAdminClient()
    const { error } = await adminSupabase
      .from('quiz_screens_staging')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting quiz screen:', error)
      return NextResponse.json(
        { error: `Failed to delete quiz screen: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Error in delete quiz screen route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/user-roles'

function canMutate(role: string | null): boolean {
  return role === 'admin' || role === 'dev' || role === 'developer'
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

    const { data, error } = await supabase
      .from('notification_content_templates')
      .select('notification_type, title_template, body_template, updated_at')
      .order('notification_type', { ascending: true })

    if (error) {
      console.error('Error fetching notification templates:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to fetch templates' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Notification templates GET:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
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

    const role = await getUserRole(user.id)
    if (!canMutate(role)) {
      return NextResponse.json(
        { error: 'Only admin or developer can create/update notification templates' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      notification_type,
      title_template,
      body_template,
    } = body as {
      notification_type?: string
      title_template?: string
      body_template?: string
    }

    if (!notification_type || typeof notification_type !== 'string' || !notification_type.trim()) {
      return NextResponse.json(
        { error: 'notification_type is required' },
        { status: 400 }
      )
    }

    const payload = {
      notification_type: notification_type.trim(),
      title_template: typeof title_template === 'string' ? title_template : '',
      body_template: typeof body_template === 'string' ? body_template : '',
    }

    const { error } = await supabase
      .from('notification_content_templates')
      .upsert(payload, { onConflict: 'notification_type' })

    if (error) {
      console.error('Error upserting notification template:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to save template' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Notification templates POST:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
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

    const role = await getUserRole(user.id)
    if (!canMutate(role)) {
      return NextResponse.json(
        { error: 'Only admin or developer can delete notification templates' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const notification_type = searchParams.get('notification_type')

    if (!notification_type || !notification_type.trim()) {
      return NextResponse.json(
        { error: 'notification_type query parameter is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('notification_content_templates')
      .delete()
      .eq('notification_type', notification_type.trim())

    if (error) {
      console.error('Error deleting notification template:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to delete template' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Notification templates DELETE:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

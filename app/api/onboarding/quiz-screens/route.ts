import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/user-roles'

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

    const { data, error } = await supabase
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

    const { data, error } = await supabase
      .from('quiz_screens_staging')
      .insert({
        title: title || null,
        description: description || null,
        options: options || null,
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

    const { data, error } = await supabase
      .from('quiz_screens_staging')
      .update({
        title: title !== undefined ? title : null,
        description: description !== undefined ? description : null,
        options: options !== undefined ? options : null,
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

    const { error } = await supabase
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


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
      .from('conversion_screens_staging')
      .select('*')
      .order('order_position', { ascending: true })

    if (error) {
      console.error('Error fetching conversion screens:', error)
      return NextResponse.json(
        { error: `Failed to fetch conversion screens: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ screens: data || [] }, { status: 200 })
  } catch (error: any) {
    console.error('Error in conversion screens route:', error)
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

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('conversion_screens_staging')
      .insert({
        title,
        description,
        options: options || [],
        order_position: order_position ?? 0,
        event_name: event_name || 'step',
        should_show: should_show ?? true,
        component_id: component_id || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating conversion screen:', error)
      return NextResponse.json(
        { error: `Failed to create conversion screen: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ screen: data }, { status: 201 })
  } catch (error: any) {
    console.error('Error in create conversion screen route:', error)
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

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (options !== undefined) updateData.options = options
    if (order_position !== undefined) updateData.order_position = order_position
    if (event_name !== undefined) updateData.event_name = event_name
    if (should_show !== undefined) updateData.should_show = should_show
    if (component_id !== undefined) updateData.component_id = component_id

    const { data, error } = await supabase
      .from('conversion_screens_staging')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating conversion screen:', error)
      return NextResponse.json(
        { error: `Failed to update conversion screen: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ screen: data }, { status: 200 })
  } catch (error: any) {
    console.error('Error in update conversion screen route:', error)
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
      .from('conversion_screens_staging')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting conversion screen:', error)
      return NextResponse.json(
        { error: `Failed to delete conversion screen: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Error in delete conversion screen route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


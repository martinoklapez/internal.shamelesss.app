import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { device_model, manager_id, owner } = body

    if (!device_model || device_model.trim() === '') {
      return NextResponse.json(
        { error: 'Device model is required' },
        { status: 400 }
      )
    }

    // Insert device into database
    const { data: device, error } = await supabase
      .from('devices')
      .insert({
        device_model,
        manager_id: manager_id || null,
        owner: owner || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating device:', error)
      return NextResponse.json(
        { error: `Failed to create device: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(device, { status: 201 })
  } catch (error) {
    console.error('Error in create device route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


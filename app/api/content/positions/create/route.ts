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
    const { name, image_url, category_id } = body

    if (!name || !image_url) {
      return NextResponse.json(
        { error: 'Name and image URL are required' },
        { status: 400 }
      )
    }

    const { data: position, error } = await supabase
      .from('positions')
      .insert({
        name,
        image_url,
        category_id: category_id || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating position:', error)
      return NextResponse.json(
        { error: `Failed to create position: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(position, { status: 201 })
  } catch (error) {
    console.error('Error in create position route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


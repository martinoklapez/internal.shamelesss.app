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
    const id = typeof body.id === 'string' ? body.id : ''
    const { name, image_url, category_id, game_id } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    if (!name || !image_url) {
      return NextResponse.json(
        { error: 'Name and image URL are required' },
        { status: 400 }
      )
    }
    if (!game_id || typeof game_id !== 'string') {
      return NextResponse.json({ error: 'game_id is required' }, { status: 400 })
    }

    const tableName = game_id === 'date-roulette' ? 'date_roulette_positions' : 'positions'

    const { data, error } = await supabase
      .from(tableName)
      .update({
        name,
        image_url,
        category_id: category_id ?? null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating position:', error)
      return NextResponse.json(
        { error: `Failed to update position: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Error in update position route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

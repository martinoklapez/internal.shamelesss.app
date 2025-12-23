import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { updateCharacter } from '@/lib/database/characters'

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
    const { id, name } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Character ID is required' },
        { status: 400 }
      )
    }

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Character name is required' },
        { status: 400 }
      )
    }

    const character = await updateCharacter(id, name.trim())

    return NextResponse.json(character, { status: 200 })
  } catch (error: any) {
    console.error('Error in update character route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createCharacter } from '@/lib/database/characters'

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
    const { name } = body

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Character name is required' },
        { status: 400 }
      )
    }

    const character = await createCharacter(name.trim())

    return NextResponse.json(character, { status: 201 })
  } catch (error: any) {
    console.error('Error in create character route:', error)
    const errorMessage = error?.message || error?.toString() || 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}


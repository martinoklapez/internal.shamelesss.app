import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getCharacters } from '@/lib/database/characters'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const characters = await getCharacters()

    return NextResponse.json({ characters }, { status: 200 })
  } catch (error: any) {
    console.error('Error in list characters route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


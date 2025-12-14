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
    const { title, category_id, difficulty_level, shared_description, media, player1_role_title, player1_twist, player2_role_title, player2_twist, player3_role_title, player3_twist, player4_role_title, player4_twist } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    const { data: scenario, error } = await supabase
      .from('roleplay_scenarios')
      .insert({
        title,
        category_id: category_id || null,
        difficulty_level: difficulty_level || 'medium',
        shared_description: shared_description || null,
        media: media || null,
        player1_role_title: player1_role_title || null,
        player1_twist: player1_twist || null,
        player2_role_title: player2_role_title || null,
        player2_twist: player2_twist || null,
        player3_role_title: player3_role_title || null,
        player3_twist: player3_twist || null,
        player4_role_title: player4_role_title || null,
        player4_twist: player4_twist || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating roleplay scenario:', error)
      return NextResponse.json(
        { error: `Failed to create scenario: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(scenario, { status: 201 })
  } catch (error) {
    console.error('Error in create roleplay scenario route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


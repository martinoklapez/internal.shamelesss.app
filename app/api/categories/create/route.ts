import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { gameId, name, description, emoji } = await request.json()

    if (!gameId || !name || !description || !emoji) {
      return NextResponse.json(
        { error: 'Missing required fields: gameId, name, description, and emoji are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Calculate the next sort_order for this game
    // Get all existing categories for this game to find the max sort_order
    const { data: existingCategories, error: fetchError } = await supabase
      .from('categories')
      .select('sort_order')
      .eq('game_id', gameId)
      .order('sort_order', { ascending: false })
      .limit(1)

    if (fetchError) {
      console.error('Error fetching existing categories:', fetchError)
      return NextResponse.json(
        { error: 'Failed to calculate sort order', details: fetchError.message },
        { status: 500 }
      )
    }

    // Calculate next sort_order (max + 1, or 1 if no categories exist)
    const nextSortOrder = existingCategories && existingCategories.length > 0
      ? (existingCategories[0].sort_order || 0) + 1
      : 1

    // Generate category ID (format: {name}-{game_id})
    const categoryId = `${name.toLowerCase().replace(/\s+/g, '-')}-${gameId}`

    // Create the category with is_active=false by default
    const { data: newCategory, error: createError } = await supabase
      .from('categories')
      .insert({
        id: categoryId,
        game_id: gameId,
        name,
        description,
        emoji,
        sort_order: nextSortOrder,
        is_active: false, // Default to inactive
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating category:', createError)
      return NextResponse.json(
        { error: 'Failed to create category', details: createError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(newCategory)
  } catch (error) {
    console.error('Error in create route:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


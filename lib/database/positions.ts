import { createClient } from '@/lib/supabase/server'
import type { Position } from '@/types/database'

export async function getPositionsByCategoryId(categoryId: string): Promise<Position[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching positions:', error)
    throw error
  }

  return data || []
}

export async function getPositionsByGameId(gameId: string): Promise<Position[]> {
  const supabase = await createClient()
  
  // First get all categories for this game
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id')
    .eq('game_id', gameId)

  if (categoriesError) {
    console.error('Error fetching categories:', categoriesError)
    throw categoriesError
  }

  if (!categories || categories.length === 0) {
    return []
  }

  const categoryIds = categories.map(c => c.id)

  // Then get all positions for these categories
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .in('category_id', categoryIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching positions:', error)
    throw error
  }

  return data || []
}


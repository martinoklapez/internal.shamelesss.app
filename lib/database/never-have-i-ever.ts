import { createClient } from '@/lib/supabase/server'
import type { NeverHaveIEverStatement } from '@/types/database'

export async function getNeverHaveIEverStatementsByCategoryId(categoryId: string): Promise<NeverHaveIEverStatement[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('never_have_i_ever_statements')
    .select('*')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching never have I ever statements:', error)
    throw error
  }

  return data || []
}

export async function getNeverHaveIEverStatementsByGameId(gameId: string): Promise<NeverHaveIEverStatement[]> {
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

  // Then get all statements for these categories
  const { data, error } = await supabase
    .from('never_have_i_ever_statements')
    .select('*')
    .in('category_id', categoryIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching never have I ever statements:', error)
    throw error
  }

  return data || []
}


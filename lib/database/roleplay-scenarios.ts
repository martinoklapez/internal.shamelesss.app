import { createClient } from '@/lib/supabase/server'
import type { RoleplayScenario } from '@/types/database'

export async function getRoleplayScenariosByCategoryId(categoryId: string): Promise<RoleplayScenario[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('roleplay_scenarios')
    .select('*')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching roleplay scenarios:', error)
    throw error
  }

  return data || []
}

export async function getRoleplayScenariosByGameId(gameId: string): Promise<RoleplayScenario[]> {
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

  // Then get all scenarios for these categories
  const { data, error } = await supabase
    .from('roleplay_scenarios')
    .select('*')
    .in('category_id', categoryIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching roleplay scenarios:', error)
    throw error
  }

  return data || []
}


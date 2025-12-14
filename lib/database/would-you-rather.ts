import { createClient } from '@/lib/supabase/server'
import type { WouldYouRatherQuestion } from '@/types/database'

export async function getWouldYouRatherQuestionsByCategoryId(categoryId: string): Promise<WouldYouRatherQuestion[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('would_you_rather_questions')
    .select('*')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching would you rather questions:', error)
    throw error
  }

  return data || []
}

export async function getWouldYouRatherQuestionsByGameId(gameId: string): Promise<WouldYouRatherQuestion[]> {
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

  // Then get all questions for these categories
  const { data, error } = await supabase
    .from('would_you_rather_questions')
    .select('*')
    .in('category_id', categoryIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching would you rather questions:', error)
    throw error
  }

  return data || []
}


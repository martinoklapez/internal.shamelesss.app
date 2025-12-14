import { createClient } from '@/lib/supabase/server'
import type { Game, Category, GameWithCategories } from '@/types/database'

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching games:', error)
    throw error
  }

  return data || []
}

export async function getCategoriesByGameId(gameId: string): Promise<Category[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('game_id', gameId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching categories:', error)
    throw error
  }

  return data || []
}

export async function getGamesWithCategories(): Promise<GameWithCategories[]> {
  const games = await getGames()
  
  const gamesWithCategories = await Promise.all(
    games.map(async (game) => {
      const categories = await getCategoriesByGameId(game.id)
      return {
        ...game,
        categories,
      }
    })
  )

  return gamesWithCategories
}


import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GameCard from '@/components/game-card'
import { getGames } from '@/lib/database/games'
import { getCategoriesByGameId } from '@/lib/database/games'
import { getUserRole } from '@/lib/user-roles'

export default async function GamesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const userRole = await getUserRole(user.id)
  
  // Only allow admin, dev, and developer roles
  if (userRole !== 'admin' && userRole !== 'dev' && userRole !== 'developer') {
    redirect('/home')
  }

  const games = await getGames()
  
  // Get category count for each game
  const gamesWithCategoryCount = await Promise.all(
    games.map(async (game) => {
      const categories = await getCategoriesByGameId(game.id)
      return {
        game,
        categoryCount: categories.length,
      }
    })
  )

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Games
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Click on a game to manage its categories
            </p>
          </div>
        </div>
        
        {games.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No games found.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {gamesWithCategoryCount.map(({ game, categoryCount }) => (
              <GameCard key={game.id} game={game} categoryCount={categoryCount} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


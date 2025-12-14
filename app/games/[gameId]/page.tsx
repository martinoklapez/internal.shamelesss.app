import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import CategoryManager from '@/components/category-manager'
import { getGames } from '@/lib/database/games'
import { getCategoriesByGameId } from '@/lib/database/games'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface GamePageProps {
  params: {
    gameId: string
  }
}

export default async function GamePage({ params }: GamePageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const games = await getGames()
  const game = games.find((g) => g.id === params.gameId)

  if (!game) {
    notFound()
  }

  const categories = await getCategoriesByGameId(params.gameId)

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/games">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {game.title}
              </h1>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="bg-white rounded-lg border border-gray-200 p-6 h-fit">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Details
              </h2>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${
                  game.is_active
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                {game.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">ID:</span> {game.id}
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p><span className="font-semibold">Created:</span> {new Date(game.created_at).toLocaleDateString()}</p>
              <p><span className="font-semibold">Updated:</span> {new Date(game.updated_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <CategoryManager gameId={game.id} categories={categories} gameTitle={game.title} />
          </div>
        </div>
      </div>
    </div>
  )
}


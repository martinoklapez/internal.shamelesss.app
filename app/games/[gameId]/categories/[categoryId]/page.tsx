import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getGames } from '@/lib/database/games'
import { getCategoriesByGameId } from '@/lib/database/games'
import { getRoleplayScenariosByCategoryId } from '@/lib/database/roleplay-scenarios'
import { getWouldYouRatherQuestionsByCategoryId } from '@/lib/database/would-you-rather'
import { getNeverHaveIEverStatementsByCategoryId } from '@/lib/database/never-have-i-ever'
import { getMostLikelyToQuestionsByCategoryId } from '@/lib/database/most-likely-to'
import { getPositionsByCategoryId } from '@/lib/database/positions'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import RoleplayScenariosList from '@/components/roleplay-scenarios-list'
import WouldYouRatherList from '@/components/would-you-rather-list'
import NeverHaveIEverList from '@/components/never-have-i-ever-list'
import MostLikelyToList from '@/components/most-likely-to-list'
import PositionsList from '@/components/positions-list'

interface CategoryContentPageProps {
  params: {
    gameId: string
    categoryId: string
  }
}

export default async function CategoryContentPage({ params }: CategoryContentPageProps) {
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
  const category = categories.find((c) => c.id === params.categoryId)

  if (!category) {
    notFound()
  }

  // Fetch content based on game type
  let scenarios: any[] = []
  let questions: any[] = []
  let statements: any[] = []
  let mostLikelyToQuestions: any[] = []
  let positions: any[] = []
  
  if (game.id === 'role-play-generator') {
    scenarios = await getRoleplayScenariosByCategoryId(params.categoryId)
  } else if (game.id === 'would-you-rather') {
    questions = await getWouldYouRatherQuestionsByCategoryId(params.categoryId)
  } else if (game.id === 'never-have-i-ever') {
    statements = await getNeverHaveIEverStatementsByCategoryId(params.categoryId)
  } else if (game.id === 'most-likely-to') {
    mostLikelyToQuestions = await getMostLikelyToQuestionsByCategoryId(params.categoryId)
  } else if (game.id === 'scratch-dates' || game.id === 'date-roulette') {
    positions = await getPositionsByCategoryId(params.categoryId, params.gameId)
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex items-center gap-2 sm:gap-4 mb-6 sm:mb-8">
          <Link href={`/games/${params.gameId}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white break-words">
              {category.emoji} {category.name}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
              {game.title} - {
                game.id === 'role-play-generator' 
                  ? `${scenarios.length} scenarios`
                  : game.id === 'would-you-rather'
                  ? `${questions.length} questions`
                  : game.id === 'never-have-i-ever'
                  ? `${statements.length} statements`
                  : game.id === 'most-likely-to'
                  ? `${mostLikelyToQuestions.length} questions`
                  : game.id === 'scratch-dates' || game.id === 'date-roulette'
                  ? `${positions.length} positions`
                  : '0 items'
              }
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          {game.id === 'role-play-generator' ? (
            <RoleplayScenariosList 
              scenarios={scenarios} 
              categoryId={params.categoryId}
              gameId={params.gameId}
            />
          ) : game.id === 'would-you-rather' ? (
            <WouldYouRatherList 
              questions={questions} 
              categoryId={params.categoryId}
              gameId={params.gameId}
            />
          ) : game.id === 'never-have-i-ever' ? (
            <NeverHaveIEverList 
              statements={statements} 
              categoryId={params.categoryId}
              gameId={params.gameId}
            />
          ) : game.id === 'most-likely-to' ? (
            <MostLikelyToList 
              questions={mostLikelyToQuestions} 
              categoryId={params.categoryId}
              gameId={params.gameId}
            />
          ) : game.id === 'scratch-dates' || game.id === 'date-roulette' ? (
            <PositionsList 
              positions={positions} 
              categoryId={params.categoryId}
              gameId={params.gameId}
            />
          ) : (
            <p className="text-gray-500 dark:text-gray-400">
              Content management for this game type is not yet implemented.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}


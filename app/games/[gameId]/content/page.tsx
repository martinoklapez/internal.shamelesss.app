import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getGames } from '@/lib/database/games'
import { getRoleplayScenariosByGameId } from '@/lib/database/roleplay-scenarios'
import { getWouldYouRatherQuestionsByGameId } from '@/lib/database/would-you-rather'
import { getNeverHaveIEverStatementsByGameId } from '@/lib/database/never-have-i-ever'
import { getMostLikelyToQuestionsByGameId } from '@/lib/database/most-likely-to'
import { getPositionsByGameId } from '@/lib/database/positions'
import { getCategoriesByGameId } from '@/lib/database/games'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import RoleplayScenariosList from '@/components/roleplay-scenarios-list'
import WouldYouRatherList from '@/components/would-you-rather-list'
import NeverHaveIEverList from '@/components/never-have-i-ever-list'
import MostLikelyToList from '@/components/most-likely-to-list'
import PositionsList from '@/components/positions-list'

interface GameContentPageProps {
  params: {
    gameId: string
  }
}

export default async function GameContentPage({ params }: GameContentPageProps) {
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

  // Fetch content based on game type
  let scenarios: any[] = []
  let questions: any[] = []
  let statements: any[] = []
  let mostLikelyToQuestions: any[] = []
  let positions: any[] = []
  let categories: any[] = []
  
  if (game.id === 'role-play-generator') {
    scenarios = await getRoleplayScenariosByGameId(params.gameId)
    categories = await getCategoriesByGameId(params.gameId)
  } else if (game.id === 'would-you-rather') {
    questions = await getWouldYouRatherQuestionsByGameId(params.gameId)
    categories = await getCategoriesByGameId(params.gameId)
  } else if (game.id === 'never-have-i-ever') {
    statements = await getNeverHaveIEverStatementsByGameId(params.gameId)
    categories = await getCategoriesByGameId(params.gameId)
  } else if (game.id === 'most-likely-to') {
    mostLikelyToQuestions = await getMostLikelyToQuestionsByGameId(params.gameId)
    categories = await getCategoriesByGameId(params.gameId)
  } else if (game.id === 'scratch-dates' || game.id === 'date-roulette') {
    positions = await getPositionsByGameId(params.gameId)
    categories = await getCategoriesByGameId(params.gameId)
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/games/${params.gameId}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              All Content
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
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

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {game.id === 'role-play-generator' ? (
            <RoleplayScenariosList 
              scenarios={scenarios} 
              categoryId=""
              gameId={params.gameId}
              showCategory={true}
              categories={categories}
            />
          ) : game.id === 'would-you-rather' ? (
            <WouldYouRatherList 
              questions={questions} 
              categoryId=""
              gameId={params.gameId}
              showCategory={true}
              categories={categories}
            />
          ) : game.id === 'never-have-i-ever' ? (
            <NeverHaveIEverList 
              statements={statements} 
              categoryId=""
              gameId={params.gameId}
              showCategory={true}
              categories={categories}
            />
          ) : game.id === 'most-likely-to' ? (
            <MostLikelyToList 
              questions={mostLikelyToQuestions} 
              categoryId=""
              gameId={params.gameId}
              showCategory={true}
              categories={categories}
            />
          ) : game.id === 'scratch-dates' || game.id === 'date-roulette' ? (
            <PositionsList 
              positions={positions} 
              categoryId=""
              gameId={params.gameId}
              showCategory={true}
              categories={categories}
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

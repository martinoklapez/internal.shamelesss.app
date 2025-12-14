'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import type { Game } from '@/types/database'
import { getGameImagePath } from '@/lib/game-images'

interface GameCardProps {
  game: Game
  categoryCount: number
}

export default function GameCard({ game, categoryCount }: GameCardProps) {
  const [imageError, setImageError] = useState(false)
  const imagePath = imageError ? '/assets/games/default.png' : getGameImagePath(game.id)

  return (
    <Link href={`/games/${game.id}`}>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer h-full flex flex-col">
        <div className="h-32 relative bg-transparent flex items-center justify-center p-4">
          <Image
            src={imagePath}
            alt={game.title}
            width={120}
            height={120}
            className="object-contain max-w-full max-h-full"
            onError={() => setImageError(true)}
            unoptimized
          />
        </div>
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex-1">
              {game.title}
            </h3>
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full shrink-0 ${
                game.is_active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }`}
            >
              {game.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2 flex-1">
            {game.description}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-auto">
            <span>{categoryCount} categories</span>
          </div>
        </div>
      </div>
    </Link>
  )
}


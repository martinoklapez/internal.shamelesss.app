'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CharacterDialog } from './character-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDate } from '@/lib/utils/date'
import type { AICharacter, CharacterReferenceImage } from '@/types/database'

interface CharactersManagerProps {
  initialCharacters: AICharacter[]
  characterData?: Record<string, { reference_images: CharacterReferenceImage[] }>
}

export default function CharactersManager({ initialCharacters, characterData = {} }: CharactersManagerProps) {
  const [characters, setCharacters] = useState<AICharacter[]>(initialCharacters)

  useEffect(() => {
    setCharacters(initialCharacters)
  }, [initialCharacters])

  const handleCharacterCreated = (character: AICharacter) => {
    setCharacters([character, ...characters])
  }

  const handleCharacterUpdated = (updatedCharacter: AICharacter) => {
    setCharacters(characters.map(c => c.id === updatedCharacter.id ? updatedCharacter : c))
  }

  const handleCharacterDeleted = (characterId: string) => {
    setCharacters(characters.filter(c => c.id !== characterId))
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-2">
        <h2 className="text-sm font-semibold text-gray-700">Characters</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-gray-500">{characters.length} total</span>
          <CharacterDialog onCharacterCreated={handleCharacterCreated}>
            <Button size="sm" variant="outline" className="h-8 flex-1 sm:flex-initial">
              <Plus className="h-4 w-4 mr-1" />
              <span className="sm:inline">Add Character</span>
            </Button>
          </CharacterDialog>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {characters.length === 0 ? (
          <div className="px-6 py-6 text-sm text-gray-500 text-center">
            No characters found. Create your first character to get started.
          </div>
        ) : (
          characters.map((character) => {
            const referenceImages = characterData[character.id]?.reference_images || []
            const profileImage = referenceImages.find(img => img.is_default)?.image_url || 
                               referenceImages[0]?.image_url

            return (
              <div
                key={character.id}
                className="px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <Link
                  href={`/characters/${character.id}`}
                  className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4"
                >
                  <Avatar className="h-12 w-12 sm:h-16 sm:w-16 rounded-lg shrink-0">
                    {profileImage ? (
                      <AvatarImage
                        src={profileImage}
                        alt={character.name}
                        className="rounded-lg"
                      />
                    ) : (
                      <AvatarFallback className="rounded-lg">
                        <User className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {character.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Created {formatDate(character.created_at)}
                    </p>
                  </div>
                </Link>
              <div className="flex items-center gap-2 shrink-0">
                <CharacterDialog
                  character={character}
                  onCharacterUpdated={handleCharacterUpdated}
                  onCharacterDeleted={handleCharacterDeleted}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </CharacterDialog>
              </div>
            </div>
          )
          })
        )}
      </div>
    </div>
  )
}


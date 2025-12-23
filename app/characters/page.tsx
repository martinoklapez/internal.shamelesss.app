import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/user-roles'
import { getCharacters, getCharacter } from '@/lib/database/characters'
import CharactersManager from '@/components/characters-manager'
import type { CharacterReferenceImage } from '@/types/database'

export default async function CharactersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const userRole = await getUserRole(user.id)
  if (userRole !== 'admin' && userRole !== 'dev' && userRole !== 'developer' && userRole !== 'promoter') {
    redirect('/home')
  }

  const characters = await getCharacters()

  // Fetch reference images for all characters to get profile pictures
  const characterData: Record<string, { reference_images: CharacterReferenceImage[] }> = {}
  for (const character of characters) {
    const fullCharacter = await getCharacter(character.id)
    if (fullCharacter) {
      characterData[character.id] = {
        reference_images: fullCharacter.reference_images,
      }
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Characters
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Manage characters and their reference images for AI image generation
          </p>
        </div>

        <CharactersManager initialCharacters={characters} characterData={characterData} />
      </div>
    </div>
  )
}


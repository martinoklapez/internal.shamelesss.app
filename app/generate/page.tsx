import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/user-roles'
import { getCharacters, getCharacter } from '@/lib/database/characters'
import { GenerateImageForm } from '@/components/generate-image-form'
import type { CharacterReferenceImage } from '@/types/database'

export default async function GeneratePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const userRole = await getUserRole(user.id)
  if (userRole !== 'admin' && userRole !== 'dev' && userRole !== 'developer') {
    redirect('/home')
  }

  const characters = await getCharacters()

  // Fetch reference images for all characters
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
    <div className="h-full w-full">
      <GenerateImageForm characters={characters} characterData={characterData} />
    </div>
  )
}


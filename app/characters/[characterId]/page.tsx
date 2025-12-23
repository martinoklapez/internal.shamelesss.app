import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getUserRole } from '@/lib/user-roles'
import { getCharacter } from '@/lib/database/characters'
import { GeneratedImagesGallery } from '@/components/generated-images-gallery'
import { CharacterDialog } from '@/components/character-dialog'
import { ReferenceImagesModal } from '@/components/reference-images-modal'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { User } from 'lucide-react'

export default async function CharacterDetailPage({
  params,
}: {
  params: { characterId: string }
}) {
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

  const character = await getCharacter(params.characterId)

  if (!character) {
    notFound()
  }

  // Get the first default reference image as the character's profile picture
  const profileImage = character.reference_images.find(img => img.is_default)?.image_url || 
                       character.reference_images[0]?.image_url

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__CHARACTER_NAME__ = ${JSON.stringify(character.name)};`,
        }}
      />
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 rounded-lg shrink-0">
              {profileImage ? (
                <AvatarImage
                  src={profileImage}
                  alt={character.name}
                  className="rounded-lg"
                />
              ) : (
                <AvatarFallback className="rounded-lg">
                  <User className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-gray-600" />
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {character.name}
              </h1>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <ReferenceImagesModal
              characterId={character.id}
              initialImages={character.reference_images}
            >
              <Button size="sm" variant="outline" className="w-full sm:w-auto">
                Manage Reference Images
              </Button>
            </ReferenceImagesModal>
            <CharacterDialog character={character} />
          </div>
        </div>

        <GeneratedImagesGallery images={character.generated_images} />
        </div>
      </div>
    </>
  )
}


import { createClient } from '@/lib/supabase/server'
import type { AICharacter, CharacterReferenceImage, CharacterGeneratedImage, CharacterWithImages } from '@/types/database'

/**
 * Get all characters
 */
export async function getCharacters(): Promise<AICharacter[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ai_characters')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    // If table doesn't exist, return empty array instead of throwing
    if (error.message.includes('does not exist') || error.code === '42P01') {
      console.warn('ai_characters table does not exist. Please run the migration.')
      return []
    }
    throw new Error(`Failed to fetch characters: ${error.message}`)
  }

  return (data as AICharacter[]) || []
}

/**
 * Get a single character with all reference and generated images
 */
export async function getCharacter(id: string): Promise<CharacterWithImages | null> {
  const supabase = await createClient()

  // Fetch character
  const { data: character, error: characterError } = await supabase
    .from('ai_characters')
    .select('*')
    .eq('id', id)
    .single()

  if (characterError || !character) {
    return null
  }

  // Fetch reference images
  const { data: referenceImages, error: refError } = await supabase
    .from('character_reference_images')
    .select('*')
    .eq('character_id', id)
    .order('created_at', { ascending: false })

  if (refError) {
    // If table doesn't exist, return empty array
    if (refError.message.includes('does not exist') || refError.code === '42P01') {
      console.warn('character_reference_images table does not exist. Please run the migration.')
      return {
        ...(character as AICharacter),
        reference_images: [],
        generated_images: [],
      }
    }
    throw new Error(`Failed to fetch reference images: ${refError.message}`)
  }

  // Fetch generated images (excluding archived)
  const { data: generatedImages, error: genError } = await supabase
    .from('character_generated_images')
    .select('*')
    .eq('character_id', id)
    .eq('is_archived', false)
    .order('generation_number', { ascending: false })

  if (genError) {
    // If table doesn't exist, return empty array
    if (genError.message.includes('does not exist') || genError.code === '42P01') {
      console.warn('character_generated_images table does not exist. Please run the migration.')
      return {
        ...(character as AICharacter),
        reference_images: (referenceImages as CharacterReferenceImage[]) || [],
        generated_images: [],
      }
    }
    throw new Error(`Failed to fetch generated images: ${genError.message}`)
  }

  return {
    ...(character as AICharacter),
    reference_images: (referenceImages as CharacterReferenceImage[]) || [],
    generated_images: (generatedImages as CharacterGeneratedImage[]) || [],
  }
}

/**
 * Create a new character
 */
export async function createCharacter(name: string): Promise<AICharacter> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ai_characters')
    .insert({
      name,
    })
    .select()
    .single()

  if (error) {
    // Handle case where table doesn't exist
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      throw new Error('Database tables not found. Please run the SQL migration in Supabase Dashboard.')
    }
    throw new Error(`Failed to create character: ${error.message || error.details || JSON.stringify(error)}`)
  }

  if (!data) {
    throw new Error('Failed to create character: No data returned')
  }

  return data as AICharacter
}

/**
 * Update a character's name
 */
export async function updateCharacter(id: string, name: string): Promise<AICharacter> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ai_characters')
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update character: ${error.message}`)
  }

  return data as AICharacter
}

/**
 * Delete a character (cascades to images via foreign key)
 */
export async function deleteCharacter(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('ai_characters')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete character: ${error.message}`)
  }
}

/**
 * Get the next generation number for a character
 */
export async function getNextGenerationNumber(characterId: string): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('character_generated_images')
    .select('generation_number')
    .eq('character_id', characterId)
    .order('generation_number', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    // If table doesn't exist, start at 1
    if (error.message.includes('does not exist') || error.code === '42P01') {
      console.warn('character_generated_images table does not exist. Starting at generation 1.')
      return 1
    }
    // PGRST116 = no rows returned, which is fine
    if (error.code === 'PGRST116') {
      return 1
    }
    throw new Error(`Failed to get next generation number: ${error.message}`)
  }

  // If no images exist, start at 1
  if (!data) {
    return 1
  }

  return (data.generation_number as number) + 1
}

/**
 * Archive or unarchive a generated image
 */
export async function archiveGeneratedImage(
  imageId: string,
  isArchived: boolean
): Promise<CharacterGeneratedImage> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('character_generated_images')
    .update({ is_archived: isArchived })
    .eq('id', imageId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to ${isArchived ? 'archive' : 'unarchive'} image: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Failed to ${isArchived ? 'archive' : 'unarchive'} image: No data returned`)
  }

  return data as CharacterGeneratedImage
}


export type Game = {
  id: string
  title: string
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Category = {
  id: string
  game_id: string
  name: string
  description: string
  emoji: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type GameWithCategories = Game & {
  categories: Category[]
}

export type RoleplayScenario = {
  id: string
  title: string
  media: string | null
  category_id: string | null
  difficulty_level: 'easy' | 'medium' | 'hard' | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  shared_description: string | null
  player1_role_title: string | null
  player1_twist: string | null
  player2_role_title: string | null
  player2_twist: string | null
  player3_role_title: string | null
  player3_twist: string | null
  player4_role_title: string | null
  player4_twist: string | null
}

export type WouldYouRatherQuestion = {
  id: string
  question: string
  option_a: string
  option_b: string
  category_id: string | null
  difficulty_level: 'easy' | 'medium' | 'hard' | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

export type NeverHaveIEverStatement = {
  id: string
  statement: string
  category_id: string | null
  difficulty_level: 'easy' | 'medium' | 'hard' | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

export type MostLikelyToQuestion = {
  id: string
  question: string
  category_id: string | null
  difficulty_level: 'easy' | 'medium' | 'hard' | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

export type Position = {
  id: string
  name: string
  image_url: string
  created_at: string
  category_id: string | null
}

export type AICharacter = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type CharacterReferenceImage = {
  id: string
  character_id: string
  image_url: string
  is_default: boolean
  created_at: string
}

export type CharacterGeneratedImage = {
  id: string
  character_id: string
  image_url: string
  prompt: string
  replicate_prediction_id: string | null
  generation_number: number
  is_archived: boolean
  created_at: string
}

export type CharacterWithImages = AICharacter & {
  reference_images: CharacterReferenceImage[]
  generated_images: CharacterGeneratedImage[]
}

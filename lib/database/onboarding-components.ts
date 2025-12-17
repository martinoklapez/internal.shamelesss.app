import { createClient } from '@/lib/supabase/server'

export interface OnboardingComponent {
  id: string
  component_key: string
  component_name: string
  categories: ('quiz' | 'conversion')[]
  description: string | null
  props_schema: any | null
  default_options: any | null
  created_at: string
  updated_at: string
}

export async function getOnboardingComponents(category?: 'quiz' | 'conversion'): Promise<OnboardingComponent[]> {
  const supabase = await createClient()
  
  let query = supabase
    .from('onboarding_components')
    .select('*')
    .order('component_name', { ascending: true })

  if (category) {
    // Filter by categories array containing the category
    // PostgREST cs (contains) operator: categories.cs.{value} checks if array contains value
    query = query.contains('categories', [category])
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching onboarding components:', error)
    throw new Error(`Failed to fetch onboarding components: ${error.message}`)
  }

  return (data || []) as OnboardingComponent[]
}


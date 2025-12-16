import { createClient } from '@/lib/supabase/server'
import type { QuizScreen, ConversionScreen } from '@/types/onboarding'

export async function getQuizScreens(): Promise<QuizScreen[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('quiz_screens_staging')
    .select('*')
    .order('order_position', { ascending: true, nullsLast: true })

  if (error) {
    console.error('Error fetching quiz screens:', error)
    throw new Error(`Failed to fetch quiz screens: ${error.message}`)
  }

  return (data || []) as QuizScreen[]
}

export async function getConversionScreens(): Promise<ConversionScreen[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('conversion_screens_staging')
    .select('*')
    .order('order_position', { ascending: true })

  if (error) {
    console.error('Error fetching conversion screens:', error)
    throw new Error(`Failed to fetch conversion screens: ${error.message}`)
  }

  return (data || []) as ConversionScreen[]
}


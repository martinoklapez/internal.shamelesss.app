import { createClient } from '@/lib/supabase/server'
import type { TruthOrDarePrompt } from '@/types/database'

export async function getTruthOrDarePrompts(): Promise<TruthOrDarePrompt[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('truth_or_dare_prompts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching truth or dare prompts:', error)
    throw error
  }

  return data || []
}

export async function getTruthOrDarePromptsByPackId(packId: string): Promise<TruthOrDarePrompt[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('truth_or_dare_prompts')
    .select('*')
    .contains('pack_ids', [packId])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching truth or dare prompts by pack:', error)
    throw error
  }

  return data || []
}

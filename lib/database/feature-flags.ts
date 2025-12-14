import { createClient } from '@/lib/supabase/server'

export interface FeatureFlag {
  id: string
  flag_id: string
  is_enabled: boolean
  description: string | null
  created_at: string
  updated_at: string
}

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .order('flag_id', { ascending: true })

  if (error) {
    console.error('Error fetching feature flags:', error)
    throw error
  }

  return data || []
}

export async function toggleFeatureFlag(flagId: string, isEnabled: boolean): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('feature_flags')
    .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() })
    .eq('flag_id', flagId)

  if (error) {
    console.error('Error toggling feature flag:', error)
    throw error
  }
}


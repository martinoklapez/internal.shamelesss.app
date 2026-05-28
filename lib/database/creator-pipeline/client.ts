import type { SupabaseClient } from '@supabase/supabase-js'
import { CREATOR_PIPELINE_SCHEMA } from '@/lib/creator-pipeline/constants'

export function creatorPipelineDb(supabase: SupabaseClient) {
  return supabase.schema(CREATOR_PIPELINE_SCHEMA)
}

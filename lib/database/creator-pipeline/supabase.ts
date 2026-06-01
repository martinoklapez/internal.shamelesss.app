import { createClient } from '@supabase/supabase-js'
import { creatorPipelineFetch } from './supabase-fetch'

/** Service-role client for creator_pipeline (admin CRM APIs only). */
export function getCreatorPipelineSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Server not configured (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required)'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    global: { fetch: creatorPipelineFetch },
  })
}

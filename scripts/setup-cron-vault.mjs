/**
 * Upsert Vault secrets for pg_cron → Edge using .env.local
 *
 * Prereq: run migration 20260610150000_creator_pipeline_setup_cron_vault_rpc.sql
 * Usage: npm run setup:cron-vault
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvLocal } from './load-env-local.mjs'

const env = loadEnvLocal()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const cronSecret = env.CREATOR_OUTREACH_CRON_SECRET?.trim()

if (!supabaseUrl || !serviceKey || !cronSecret) {
  console.error(
    'Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CREATOR_OUTREACH_CRON_SECRET in .env.local'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data, error } = await supabase.rpc('setup_creator_pipeline_cron_vault', {
  project_url: supabaseUrl.replace(/\/$/, ''),
  cron_secret: cronSecret,
})

if (error) {
  console.error('setup_creator_pipeline_cron_vault failed:', error.message)
  console.error(
    '\nApply migration first (SQL editor):\n  supabase/migrations/20260610150000_creator_pipeline_setup_cron_vault_rpc.sql'
  )
  process.exit(1)
}

console.log(data ?? 'ok')

const smoke = await fetch(
  `${supabaseUrl.replace(/\/$/, '')}/functions/v1/process-creator-outreach-sends`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cronSecret}`,
    },
    body: '{}',
  }
)

const smokeText = await smoke.text()
console.log(`Edge smoke test HTTP ${smoke.status}`)
try {
  console.log(JSON.stringify(JSON.parse(smokeText), null, 2))
} catch {
  console.log(smokeText)
}

console.log('\nCron DB smoke test — run in SQL editor:')
console.log('  select creator_pipeline.invoke_edge_function(\'process-creator-outreach-sends\');')

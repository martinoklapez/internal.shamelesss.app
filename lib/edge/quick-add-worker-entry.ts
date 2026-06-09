/** esbuild entry — bundled into supabase/functions/_shared for Edge deploy. */
export {
  processPendingQuickAddJobs,
  type ProcessQuickAddJobsResult,
} from '@/lib/database/creator-pipeline/process-quick-add-scrape'
export { readRuntimeEnv } from '@/lib/runtime/env'

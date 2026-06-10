import { readRuntimeEnv } from '@/lib/runtime/env'

/** Bearer token for Edge worker invokes (cron secret preferred over service-role JWT). */
export function edgeWorkerInvokeHeaders(): Record<string, string> | undefined {
  const cronSecret = readRuntimeEnv('CREATOR_OUTREACH_CRON_SECRET')?.trim()
  if (!cronSecret) return undefined
  return { Authorization: `Bearer ${cronSecret}` }
}

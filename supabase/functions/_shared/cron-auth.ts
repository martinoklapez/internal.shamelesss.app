// @ts-nocheck — Deno deploy target
/** Authorize cron / worker invocations (service role or shared cron secret). */
export function isCronAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization')?.trim()
  if (!auth?.startsWith('Bearer ')) return false

  const token = auth.slice('Bearer '.length).trim()
  if (!token) return false

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (serviceKey && token === serviceKey) return true

  const cronSecret = Deno.env.get('CREATOR_OUTREACH_CRON_SECRET')?.trim()
  if (cronSecret && token === cronSecret) return true

  return false
}

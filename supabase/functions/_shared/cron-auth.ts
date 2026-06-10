// @ts-nocheck — Deno deploy target
function isServiceRoleJwt(token: string): boolean {
  if (!token.startsWith('eyJ')) return false
  const parts = token.split('.')
  if (parts.length < 2) return false
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.role === 'service_role'
  } catch {
    return false
  }
}

/** Authorize cron / worker invocations (service role or shared cron secret). */
export function isCronAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization')?.trim()
  if (!auth?.startsWith('Bearer ')) return false

  const token = auth.slice('Bearer '.length).trim()
  if (!token) return false

  const cronSecret = Deno.env.get('CREATOR_OUTREACH_CRON_SECRET')?.trim()
  if (cronSecret && token === cronSecret) return true

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (serviceKey && token === serviceKey) return true

  if (isServiceRoleJwt(token)) return true

  return false
}

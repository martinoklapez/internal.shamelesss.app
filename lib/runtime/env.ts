/** Read env vars in Node (Next.js) and Deno (Supabase Edge Functions). */
export function readRuntimeEnv(name: string): string | undefined {
  const deno = (globalThis as { Deno?: { env: { get: (key: string) => string | undefined } } }).Deno
  if (deno?.env) {
    const v = deno.env.get(name)
    if (v?.trim()) return v.trim()
  }
  if (typeof process !== 'undefined' && process.env) {
    const v = process.env[name]
    if (v?.trim()) return v.trim()
  }
  return undefined
}

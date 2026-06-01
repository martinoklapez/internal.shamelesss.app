const APIFY_API_BASE = 'https://api.apify.com/v2'

export function getApifyApiToken(): string | undefined {
  const token = process.env.APIFY_API_TOKEN?.trim()
  return token || undefined
}

/** `apify/instagram-profile-scraper` → `apify~instagram-profile-scraper` */
export function apifyActorIdToPath(actorId: string): string {
  return actorId.includes('/') ? actorId.replace('/', '~') : actorId
}

/**
 * Runs an Actor synchronously and returns all dataset items.
 * @see https://docs.apify.com/api/v2#/reference/actors/run-actor-synchronously-and-get-dataset-items
 */
export async function runApifyActorSyncGetDatasetItems<T>(
  actorId: string,
  input: Record<string, unknown>,
  options?: { timeoutMs?: number }
): Promise<T[]> {
  const token = getApifyApiToken()
  if (!token) {
    throw new Error('APIFY_API_TOKEN is not configured')
  }

  const path = apifyActorIdToPath(actorId)
  const timeoutMs = options?.timeoutMs ?? 120_000
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = `${APIFY_API_BASE}/acts/${path}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(
        `Apify actor ${actorId} failed (${response.status}): ${body.slice(0, 500)}`
      )
    }

    const items: unknown = await response.json()
    return Array.isArray(items) ? (items as T[]) : []
  } finally {
    clearTimeout(timeout)
  }
}

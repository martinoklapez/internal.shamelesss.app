const FETCH_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 3

function isRetriableFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  const cause =
    error.cause instanceof Error ? error.cause.message.toLowerCase() : String(error.cause ?? '')
  const combined = `${msg} ${cause}`
  return (
    combined.includes('fetch failed') ||
    combined.includes('timeout') ||
    combined.includes('econnreset') ||
    combined.includes('econnrefused') ||
    combined.includes('connect timeout') ||
    combined.includes('und_err_connect_timeout')
  )
}

/** Fetch wrapper for creator_pipeline API routes (retries transient Supabase/network failures). */
export async function creatorPipelineFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const signal =
        init?.signal ??
        (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
          ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
          : undefined)
      return await fetch(input, { ...init, signal })
    } catch (error) {
      lastError = error
      if (!isRetriableFetchError(error) || attempt === MAX_ATTEMPTS) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt))
    }
  }
  throw lastError
}

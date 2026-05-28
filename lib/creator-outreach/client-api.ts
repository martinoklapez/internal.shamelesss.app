import type { CreatorOutreachStore } from './types'
import type { EvaluateOutreachResult } from './store'

export async function fetchCreatorOutreachStore(): Promise<CreatorOutreachStore> {
  const res = await fetch('/api/creator-pipeline', { cache: 'no-store' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Failed to load pipeline (${res.status})`)
  }
  return res.json() as Promise<CreatorOutreachStore>
}

export async function mutateCreatorOutreach<T extends Record<string, unknown>>(
  body: T
): Promise<{ store: CreatorOutreachStore; outreach?: EvaluateOutreachResult }> {
  const res = await fetch('/api/creator-pipeline/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Pipeline update failed (${res.status})`)
  }
  return res.json() as Promise<{ store: CreatorOutreachStore; outreach?: EvaluateOutreachResult }>
}

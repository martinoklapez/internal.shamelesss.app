/** Coerce scraped follower counts to a non-negative integer or null. */
export function normalizeFollowerCount(value: unknown): number | null {
  if (value == null) return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null
    return Math.floor(value)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/,/g, '')
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) return null
    return Math.floor(parsed)
  }

  return null
}

export function formatFollowerCountShort(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return String(count)
}

/**
 * Format date consistently to avoid hydration errors
 * Uses a consistent format that works the same on server and client
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day}/${year}`
}

/**
 * Human-friendly relative time for “Created” columns (minutes / hours / days ago, Yesterday).
 * Uses the viewer’s local calendar for day-boundary wording.
 */
export function formatRelativeCreated(iso: string | null | undefined, nowArg?: Date): string {
  const raw = typeof iso === 'string' ? iso.trim() : ''
  if (!raw) return ''

  const d = new Date(raw)
  const t = d.getTime()
  if (Number.isNaN(t)) return ''

  const now = nowArg ?? new Date()
  const diffMs = now.getTime() - t

  const sec = Math.floor(diffMs / 1000)

  if (sec < -120) {
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  }
  if (sec < 0) return 'Just now'

  if (sec < 45) return 'Just now'

  if (sec < 3600) {
    const minutes = Math.floor(sec / 60)
    return minutes <= 1 ? '1 minute ago' : `${minutes} minutes ago`
  }

  if (sec < 86400) {
    const hours = Math.floor(sec / 3600)
    return hours <= 1 ? '1 hour ago' : `${hours} hours ago`
  }

  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startCreated = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const calendarDayDiff = Math.round((startToday - startCreated) / 86400000)

  // Same local calendar day but ≥24h elapsed (DST): still “today”.
  if (calendarDayDiff === 0 && sec >= 86400) return 'Today'

  if (calendarDayDiff === 1) return 'Yesterday'

  if (calendarDayDiff > 1 && calendarDayDiff < 7) {
    return `${calendarDayDiff} days ago`
  }

  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

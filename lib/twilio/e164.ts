export function normalizeE164(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('+')) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  return digits ? `+${digits}` : trimmed
}

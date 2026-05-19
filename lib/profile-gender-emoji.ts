/** Fallback emoji when profile photo is missing (Support Chat, Profiles admin, etc.). */
export function profileGenderEmoji(gender: string | null | undefined): string {
  const g = gender?.trim().toLowerCase()
  if (g === 'male') return '👨'
  if (g === 'female') return '👩'
  return '🧑'
}

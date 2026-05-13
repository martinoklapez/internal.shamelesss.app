/**
 * JSON you download before removing users; restore recreates auth + user_roles + profiles (not storage).
 * `role` is the value from `user_roles.role` at export time (selected export supports any role; “all demo” exports are role demo).
 */

export const DEMO_USERS_BACKUP_FORMAT_VERSION = 1 as const

export type DemoUserBackupEntry = {
  /** Supabase Auth email, if any (phone-only accounts may omit). */
  email?: string | null
  /** Supabase Auth phone (`E.164`), if any — used on restore when email is missing. Older backups omit this key. */
  phone?: string | null
  /** `user_roles.role` at export (e.g. demo, admin, developer, user). */
  role: string
  /** Previous auth user id — new user gets a new id on restore. */
  former_user_id: string
  /** Full `profiles` row as returned by Postgres; `user_id` is ignored on restore. */
  profile: Record<string, unknown> | null
}

export type DemoUsersBackupFile = {
  format_version: typeof DEMO_USERS_BACKUP_FORMAT_VERSION
  exported_at: string
  users: DemoUserBackupEntry[]
}

export function isDemoUsersBackupFile(v: unknown): v is DemoUsersBackupFile {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    o.format_version === DEMO_USERS_BACKUP_FORMAT_VERSION &&
    typeof o.exported_at === 'string' &&
    Array.isArray(o.users)
  )
}

/** Build insert payload: same profile columns as backup, new auth id. */
export function profileRowForNewUser(
  newUserId: string,
  profile: Record<string, unknown> | null
): Record<string, unknown> {
  if (!profile || Object.keys(profile).length === 0) {
    return { user_id: newUserId }
  }
  const { user_id: _removed, ...rest } = profile
  return { ...rest, user_id: newUserId }
}

/** When Auth has no email and no phone, restore still needs a unique email for `createUser`. */
export function syntheticEmailForNoIdentifier(formerUserId: string): string {
  const safe = formerUserId.replace(/[^a-f0-9-]/gi, '').slice(0, 36)
  return `no-email-${safe || 'unknown'}@backup.internal`
}

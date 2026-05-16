import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { PROFILES_BACKUP_PASSCODE_HEADER } from '@/lib/profiles-backup-passcode-constants'

export function getProfilesBackupPasscodeMeta(): {
  configured: boolean
  length: number | null
} {
  const raw = process.env.PROFILES_BACKUP_PASSCODE?.trim() ?? ''
  if (!raw.length) {
    return { configured: false, length: null }
  }
  return { configured: true, length: raw.length }
}

export function isProfilesBackupPasscodeConfigured(): boolean {
  return getProfilesBackupPasscodeMeta().configured
}

function passcodesEqual(supplied: string, configured: string): boolean {
  const a = Buffer.from(supplied, 'utf8')
  const b = Buffer.from(configured, 'utf8')
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Use for POST `/verify-backup-passcode` bodies. */
export function verifyProfilesBackupPasscodeString(supplied: string): boolean {
  const configured = process.env.PROFILES_BACKUP_PASSCODE?.trim()
  if (!configured) return true
  return passcodesEqual(supplied, configured)
}

/**
 * API routes under profiles-cleanup that mutate/export users apply this **after** session role checks.
 * If `PROFILES_BACKUP_PASSCODE` is unset → no gate (backward compatible).
 */
export function rejectIfProfilesBackupPasscodeMismatch(request: Request): NextResponse | null {
  const configured = process.env.PROFILES_BACKUP_PASSCODE?.trim()
  if (!configured) return null

  const supplied = request.headers.get(PROFILES_BACKUP_PASSCODE_HEADER) ?? ''
  if (!passcodesEqual(supplied, configured)) {
    return NextResponse.json({ error: 'Invalid or missing backup passcode' }, { status: 401 })
  }

  return null
}

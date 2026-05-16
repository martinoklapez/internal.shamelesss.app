import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'
import { verifyProfilesBackupPasscodeString } from '@/lib/profiles-backup-passcode-server'

export const dynamic = 'force-dynamic'

/** Body: `{ passcode: string }` — checked against `PROFILES_BACKUP_PASSCODE` when set. */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = await getUserRole(user.id)
    if (role !== 'admin' && role !== 'dev' && role !== 'developer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const supplied = typeof body?.passcode === 'string' ? body.passcode : ''

    const configured = process.env.PROFILES_BACKUP_PASSCODE?.trim()
    if (!configured) {
      return NextResponse.json({ verified: true, required: false }, { status: 200 })
    }

    if (!verifyProfilesBackupPasscodeString(supplied)) {
      return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 })
    }

    return NextResponse.json({ verified: true, required: true }, { status: 200 })
  } catch (e) {
    console.error('backup-passcode POST:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

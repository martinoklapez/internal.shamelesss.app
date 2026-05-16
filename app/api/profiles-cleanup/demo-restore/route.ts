import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
  isDemoUsersBackupFile,
  profileRowForNewUser,
  syntheticEmailForNoIdentifier,
} from '@/lib/demo-users-backup'
import { getUserRole } from '@/lib/user-roles'
import { rejectIfProfilesBackupPasscodeMismatch } from '@/lib/profiles-backup-passcode-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

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

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Service role key is not configured on the server' },
        { status: 500 }
      )
    }

    const backupGate = rejectIfProfilesBackupPasscodeMismatch(request)
    if (backupGate) return backupGate

    const body = await request.json()
    const backup = body?.backup
    if (!isDemoUsersBackupFile(backup)) {
      return NextResponse.json(
        { error: 'Invalid backup: expected format_version 1 and users array' },
        { status: 400 }
      )
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const restored: { identifier: string; new_user_id: string }[] = []
    const failed: { identifier: string; error: string }[] = []

    for (const entry of backup.users) {
      const emailRaw = entry.email
      const emailTrim =
        typeof emailRaw === 'string' ? emailRaw.trim() : emailRaw == null ? '' : String(emailRaw).trim()
      const phoneRaw = entry.phone
      const phoneTrim =
        phoneRaw !== undefined && phoneRaw !== null && String(phoneRaw).trim()
          ? String(phoneRaw).trim()
          : ''

      const finalPassword = crypto.randomUUID()

      let reportId = emailTrim || phoneTrim || ''

      let createResult = await (async () => {
        if (emailTrim) {
          return admin.auth.admin.createUser({
            email: emailTrim,
            password: finalPassword,
            email_confirm: true,
          })
        }
        if (phoneTrim) {
          return admin.auth.admin.createUser({
            phone: phoneTrim,
            password: finalPassword,
            phone_confirm: true,
          })
        }
        const synthetic = syntheticEmailForNoIdentifier(
          typeof entry.former_user_id === 'string' ? entry.former_user_id : 'unknown'
        )
        reportId = synthetic
        return admin.auth.admin.createUser({
          email: synthetic,
          password: finalPassword,
          email_confirm: true,
        })
      })()

      const { data: created, error: createError } = createResult

      if (createError || !created?.user) {
        const message = createError?.message || 'Failed to create auth user'
        const dup =
          message.toLowerCase().includes('already been registered') ||
          message.toLowerCase().includes('already exists') ||
          createError?.status === 422
        const id = reportId || '(missing identifier)'
        failed.push({
          identifier: id,
          error: dup ? `Already exists: ${message}` : message,
        })
        continue
      }

      const newUserId = created.user.id

      const roleRaw = typeof entry.role === 'string' ? entry.role.trim() : ''
      const roleToSet = roleRaw.length > 0 ? roleRaw : 'user'

      const { error: roleError } = await admin
        .from('user_roles')
        .upsert({ user_id: newUserId, role: roleToSet }, { onConflict: 'user_id' })

      if (roleError) {
        await admin.auth.admin.deleteUser(newUserId)
        failed.push({
          identifier: reportId || newUserId,
          error: `Role insert failed: ${roleError.message}`,
        })
        continue
      }

      const row = profileRowForNewUser(
        newUserId,
        entry.profile && typeof entry.profile === 'object' ? entry.profile : null
      )

      const { error: profileError } = await admin.from('profiles').upsert(row, { onConflict: 'user_id' })

      if (profileError) {
        await admin.from('user_roles').delete().eq('user_id', newUserId)
        await admin.auth.admin.deleteUser(newUserId)
        failed.push({
          identifier: reportId || newUserId,
          error: `Profile upsert failed: ${profileError.message}`,
        })
        continue
      }

      restored.push({ identifier: reportId || newUserId, new_user_id: newUserId })
    }

    return NextResponse.json({ restored, failed }, { status: 200 })
  } catch (e) {
    console.error('demo-restore:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

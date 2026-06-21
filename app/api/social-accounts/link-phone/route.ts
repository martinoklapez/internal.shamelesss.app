import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireDeviceManagerUser } from '@/lib/api/device-manager-auth'
import {
  requirePhoneNumberAccess,
  resolveAutoAssignUserId,
} from '@/lib/api/phone-number-auth'

export async function POST(request: Request) {
  const auth = await requireDeviceManagerUser()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const { accountId, phone_number_id } = body

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    const supabase = await createClient()

    if (phone_number_id) {
      const phoneAuth = await requirePhoneNumberAccess(phone_number_id)
      if (!phoneAuth.ok) return phoneAuth.response
    }

    const { data: account, error } = await supabase
      .from('social_accounts')
      .update({
        phone_number_id: phone_number_id || null,
      })
      .eq('id', accountId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (phone_number_id) {
      const assigneeId = await resolveAutoAssignUserId(supabase, {
        socialAccountId: accountId,
        fallbackUserId: auth.userId,
      })

      await supabase
        .from('phone_numbers')
        .update({
          assigned_user_id: assigneeId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', phone_number_id)
    }

    return NextResponse.json(account)
  } catch (error) {
    console.error('POST /api/social-accounts/link-phone:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

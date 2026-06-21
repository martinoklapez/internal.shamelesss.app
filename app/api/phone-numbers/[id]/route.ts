import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isPhoneAdmin,
  requirePhoneNumberAccess,
  resolveAutoAssignUserId,
} from '@/lib/api/phone-number-auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  const auth = await requirePhoneNumberAccess(id)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const supabase = await createClient()

    if (body.assigned_user_id !== undefined) {
      if (!isPhoneAdmin(auth.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      patch.assigned_user_id =
        body.assigned_user_id === null || body.assigned_user_id === ''
          ? null
          : body.assigned_user_id
    }

    if (body.friendly_name !== undefined) {
      patch.friendly_name = body.friendly_name?.trim() || null
    }
    if (body.country !== undefined) {
      patch.country = body.country?.trim() || null
    }
    if (body.notes !== undefined) {
      patch.notes = body.notes?.trim() || null
    }
    if (body.twilio_sid !== undefined) {
      if (!isPhoneAdmin(auth.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      patch.twilio_sid = body.twilio_sid?.trim() || null
    }
    if (body.purpose !== undefined) {
      const valid = ['tiktok_signup', 'instagram_signup', 'general']
      if (!valid.includes(body.purpose)) {
        return NextResponse.json({ error: 'Invalid purpose' }, { status: 400 })
      }
      patch.purpose = body.purpose
    }
    if (body.status !== undefined) {
      if (!isPhoneAdmin(auth.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const valid = ['active', 'reserved', 'released']
      if (!valid.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      patch.status = body.status
    }

    if (body.icloud_profile_id !== undefined) {
      if (body.icloud_profile_id === null || body.icloud_profile_id === '') {
        patch.icloud_profile_id = null
      } else {
        const { data: conflict } = await supabase
          .from('phone_numbers')
          .select('id')
          .eq('icloud_profile_id', body.icloud_profile_id)
          .neq('status', 'released')
          .neq('id', id)
          .maybeSingle()

        if (conflict) {
          return NextResponse.json(
            { error: 'Another phone number is already linked to this iCloud profile' },
            { status: 400 }
          )
        }

        patch.icloud_profile_id = body.icloud_profile_id

        if (body.assigned_user_id === undefined) {
          patch.assigned_user_id = await resolveAutoAssignUserId(supabase, {
            icloudProfileId: body.icloud_profile_id,
            fallbackUserId: auth.userId,
          })
        }
      }
    }

    const { data, error } = await supabase
      .from('phone_numbers')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PATCH /api/phone-numbers/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

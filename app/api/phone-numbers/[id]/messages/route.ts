import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePhoneNumberAccess } from '@/lib/api/phone-number-auth'
import { listSmsMessages } from '@/lib/database/phone-numbers'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const auth = await requirePhoneNumberAccess(id)
  if (!auth.ok) return auth.response

  try {
    const messages = await listSmsMessages(id)
    return NextResponse.json(messages)
  } catch (error) {
    console.error('GET /api/phone-numbers/[id]/messages:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load messages' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  const auth = await requirePhoneNumberAccess(id)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const markRead = body.mark_read === true

    if (!markRead) {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
    }

    const supabase = await createClient()
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('sms_messages')
      .update({ read_at: now })
      .eq('phone_number_id', id)
      .eq('direction', 'inbound')
      .is('read_at', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/phone-numbers/[id]/messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

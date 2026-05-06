import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const isActive = Boolean(body.is_active)

    if (!id) {
      return NextResponse.json({ error: 'id is required.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('truth_or_dare_prompts')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: `Failed to toggle prompt: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

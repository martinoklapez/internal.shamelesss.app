import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_PACK_IDS = new Set(['tod_classic', 'tod_spicy', 'tod_mixed'])

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
    const kind = body.kind === 'dare' ? 'dare' : body.kind === 'truth' ? 'truth' : null
    const promptBody = typeof body.body === 'string' ? body.body.trim() : ''
    const packIds = Array.isArray(body.pack_ids)
      ? body.pack_ids.filter((v: unknown): v is string => typeof v === 'string')
      : []
    const isActive = body.is_active !== false

    if (!kind) {
      return NextResponse.json({ error: 'kind must be "truth" or "dare".' }, { status: 400 })
    }
    if (!promptBody) {
      return NextResponse.json({ error: 'body is required.' }, { status: 400 })
    }
    if (packIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one pack_id.' }, { status: 400 })
    }
    if (packIds.some((packId: string) => !ALLOWED_PACK_IDS.has(packId))) {
      return NextResponse.json({ error: 'pack_ids contains unsupported values.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('truth_or_dare_prompts')
      .insert({
        kind,
        body: promptBody,
        pack_ids: packIds,
        is_active: isActive,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: `Failed to create prompt: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrCreateBatchId } from '@/lib/database/batch-id'

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
    const accountId = typeof body.accountId === 'string' ? body.accountId : ''

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    const { data: account, error: fetchError } = await supabase
      .from('social_accounts')
      .select('id, device_id, platform, username, status')
      .eq('id', accountId)
      .single()

    if (fetchError || !account) {
      return NextResponse.json({ error: 'Social account not found' }, { status: 404 })
    }

    if (account.status !== 'archived') {
      return NextResponse.json(
        { error: 'Only archived social accounts can be restored' },
        { status: 400 }
      )
    }

    const { data: conflicting } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('device_id', account.device_id)
      .eq('platform', account.platform)
      .eq('username', account.username)
      .neq('status', 'archived')
      .maybeSingle()

    if (conflicting) {
      return NextResponse.json(
        {
          error:
            'This device already has an active social row with the same platform and username. Remove or rename it before restoring.',
        },
        { status: 409 }
      )
    }

    const batchId = await getOrCreateBatchId(account.device_id)

    const { data: restored, error: updateError } = await supabase
      .from('social_accounts')
      .update({
        status: 'planned',
        batch_id: batchId,
      })
      .eq('id', accountId)
      .select()
      .single()

    if (updateError) {
      console.error('Error restoring social account:', updateError)
      return NextResponse.json(
        { error: `Failed to restore social account: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(restored, { status: 200 })
  } catch (error) {
    console.error('Error in restore social account route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

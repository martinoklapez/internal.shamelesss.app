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
    const targetDeviceId = Number.parseInt(String(body.targetDeviceId), 10)

    if (!accountId || Number.isNaN(targetDeviceId)) {
      return NextResponse.json(
        { error: 'accountId and targetDeviceId are required' },
        { status: 400 }
      )
    }

    const { data: account, error: accountError } = await supabase
      .from('social_accounts')
      .select('id, device_id, status')
      .eq('id', accountId)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Social account not found' }, { status: 404 })
    }

    if (account.status === 'archived') {
      return NextResponse.json(
        { error: 'Archived social accounts cannot be transferred' },
        { status: 400 }
      )
    }

    if (account.device_id === targetDeviceId) {
      return NextResponse.json(
        { error: 'Target device must be different from current device' },
        { status: 400 }
      )
    }

    const { data: targetDevice, error: targetDeviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('id', targetDeviceId)
      .single()

    if (targetDeviceError || !targetDevice) {
      return NextResponse.json({ error: 'Target device not found' }, { status: 404 })
    }

    const targetBatchId = await getOrCreateBatchId(targetDeviceId)

    const { data: updated, error: updateError } = await supabase
      .from('social_accounts')
      .update({
        device_id: targetDeviceId,
        batch_id: targetBatchId,
      })
      .eq('id', accountId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to transfer social account: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(updated, { status: 200 })
  } catch (error) {
    console.error('Error in transfer social account route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

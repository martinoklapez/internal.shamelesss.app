import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
    const { accountId } = body

    if (!accountId || typeof accountId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid accountId. Must be a non-empty string.' },
        { status: 400 }
      )
    }

    // Update the social account status to archived
    const { data: account, error } = await supabase
      .from('social_accounts')
      .update({ status: 'archived' })
      .eq('id', accountId)
      .select()
      .single()

    if (error) {
      console.error('Error archiving social account:', error)
      return NextResponse.json(
        { error: `Failed to archive social account: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(account, { status: 200 })
  } catch (error) {
    console.error('Error in archive social account route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


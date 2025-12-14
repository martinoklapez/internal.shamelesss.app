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
    const { profileId } = body

    if (!profileId || typeof profileId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid profileId. Must be a non-empty string.' },
        { status: 400 }
      )
    }

    // Update the iCloud profile status to archived
    const { data: profile, error } = await supabase
      .from('icloud_profiles')
      .update({ status: 'archived' })
      .eq('id', profileId)
      .select()
      .single()

    if (error) {
      console.error('Error archiving iCloud profile:', error)
      return NextResponse.json(
        { error: `Failed to archive iCloud profile: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(profile, { status: 200 })
  } catch (error) {
    console.error('Error in archive iCloud profile route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


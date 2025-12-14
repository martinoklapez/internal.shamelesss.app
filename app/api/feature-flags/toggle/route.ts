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

    const { flagId, isEnabled } = await request.json()

    if (!flagId || typeof isEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Update the feature flag
    const { error: updateError } = await supabase
      .from('feature_flags')
      .update({ 
        is_enabled: isEnabled,
        updated_at: new Date().toISOString()
      })
      .eq('flag_id', flagId)

    if (updateError) {
      console.error('Error updating feature flag:', updateError)
      return NextResponse.json(
        { error: 'Failed to update feature flag' },
        { status: 500 }
      )
    }

    // Fetch the updated feature flag
    const { data: updatedFlag, error: fetchError } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('flag_id', flagId)
      .single()

    if (fetchError) {
      console.error('Error fetching updated feature flag:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch updated feature flag' },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedFlag)
  } catch (error) {
    console.error('Error in feature flag toggle:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


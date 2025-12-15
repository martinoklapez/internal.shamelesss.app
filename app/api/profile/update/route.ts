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
    const { name, profile_picture_url } = body

    // Update or insert profile
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .single()

    let profile
    let error

    if (existingProfile) {
      // Update existing profile
      const updateData: { name?: string; profile_picture_url?: string | null } = {}
      if (name !== undefined) updateData.name = name
      if (profile_picture_url !== undefined) updateData.profile_picture_url = profile_picture_url

      const result = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single()
      
      profile = result.data
      error = result.error
    } else {
      // Insert new profile
      const insertData: { user_id: string; name?: string; profile_picture_url?: string | null } = {
        user_id: user.id,
      }
      if (name !== undefined) insertData.name = name
      if (profile_picture_url !== undefined) insertData.profile_picture_url = profile_picture_url

      const result = await supabase
        .from('profiles')
        .insert(insertData)
        .select()
        .single()
      
      profile = result.data
      error = result.error
    }

    if (error) {
      console.error('Error updating profile:', error)
      return NextResponse.json(
        { error: `Failed to update profile: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(profile, { status: 200 })
  } catch (error) {
    console.error('Error in update profile route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


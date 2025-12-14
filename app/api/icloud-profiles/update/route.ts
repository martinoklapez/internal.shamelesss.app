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
    const { profileId, email, credentials, alias, birthDate, country, street, city, zipCode } = body

    if (!profileId || !email || !credentials || !alias || !birthDate || !country || !street || !city || !zipCode) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Update iCloud profile in database
    const { data: profile, error } = await supabase
      .from('icloud_profiles')
      .update({
        email,
        credentials,
        alias,
        birth_date: birthDate,
        country,
        street,
        city,
        zip_code: zipCode,
      })
      .eq('id', profileId)
      .select()
      .single()

    if (error) {
      console.error('Error updating iCloud profile:', error)
      return NextResponse.json(
        { error: `Failed to update iCloud profile: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(profile, { status: 200 })
  } catch (error) {
    console.error('Error in update iCloud profile route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


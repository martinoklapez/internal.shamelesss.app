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
    const { device_id, email, credentials, alias, birthDate, country, street, city, zipCode } = body

    if (!device_id || !email || !credentials || !alias || !birthDate || !country || !street || !city || !zipCode) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Check if device already has an ACTIVE iCloud profile
    const { data: existingProfile } = await supabase
      .from('icloud_profiles')
      .select('id')
      .eq('device_id', device_id)
      .eq('status', 'active')
      .single()

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Device already has an active iCloud profile. Please archive the existing one first.' },
        { status: 400 }
      )
    }

    // Get or create batch_id for this device
    const batchId = await getOrCreateBatchId(parseInt(device_id, 10))

    // Insert iCloud profile into database
    const { data: profile, error } = await supabase
      .from('icloud_profiles')
      .insert({
        device_id: parseInt(device_id, 10),
        email,
        credentials,
        alias,
        birth_date: birthDate,
        country,
        street,
        city,
        zip_code: zipCode,
        status: 'active',
        batch_id: batchId,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating iCloud profile:', error)
      return NextResponse.json(
        { error: `Failed to create iCloud profile: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(profile, { status: 201 })
  } catch (error) {
    console.error('Error in create iCloud profile route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


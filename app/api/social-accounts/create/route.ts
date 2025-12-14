import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getTikTokAccountName } from '@/lib/tiktok-scraper'
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
    const { device_id, platform, username, credentials } = body

    if (!device_id || !platform || !username || !credentials) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (!['TikTok', 'Instagram', 'Snapchat'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be TikTok, Instagram, or Snapchat' },
        { status: 400 }
      )
    }

    // Fetch account name for TikTok
    let accountName: string | null = null
    if (platform === 'TikTok') {
      try {
        accountName = await getTikTokAccountName(username)
        if (!accountName) {
          console.warn(`Could not fetch TikTok account name for @${username}`)
        }
      } catch (error) {
        console.error(`Error fetching TikTok account name:`, error)
        // Continue without name - don't fail the request
      }
    }

    // Get or create batch_id for this device (use active iCloud profile's batch_id if exists)
    const batchId = await getOrCreateBatchId(parseInt(device_id, 10))

    // Insert social account into database
    const { data: account, error } = await supabase
      .from('social_accounts')
      .insert({
        device_id: parseInt(device_id, 10),
        platform,
        username,
        name: accountName,
        credentials,
        status: 'draft',
        batch_id: batchId,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating social account:', error)
      return NextResponse.json(
        { error: `Failed to create social account: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('Error in create social account route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getTikTokAccountName } from '@/lib/tiktok-scraper'

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
    const { accountId, platform, username, credentials } = body

    if (!accountId || !platform || !username || !credentials) {
      return NextResponse.json(
        { error: 'Account ID, platform, username, and credentials are required' },
        { status: 400 }
      )
    }

    if (!['TikTok', 'Instagram', 'Snapchat'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be TikTok, Instagram, or Snapchat' },
        { status: 400 }
      )
    }

    // Fetch account name for TikTok if platform changed or username changed
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

    // Update social account in database
    const { data: account, error } = await supabase
      .from('social_accounts')
      .update({
        platform,
        username,
        name: accountName,
        credentials,
      })
      .eq('id', accountId)
      .select()
      .single()

    if (error) {
      console.error('Error updating social account:', error)
      return NextResponse.json(
        { error: `Failed to update social account: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(account, { status: 200 })
  } catch (error) {
    console.error('Error in update social account route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


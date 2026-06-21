import { NextResponse } from 'next/server'
import { requireDeviceManagerUser } from '@/lib/api/device-manager-auth'
import { requirePhoneAdmin } from '@/lib/api/phone-number-auth'
import { syncTwilioPhoneNumbers } from '@/lib/twilio/sync-phone-numbers'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CREATOR_OUTREACH_CRON_SECRET?.trim()
  if (!secret) return false
  const header = request.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true
  const query = new URL(request.url).searchParams.get('secret')
  return query === secret
}

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    const auth = await requirePhoneAdmin()
    if (!auth.ok) return auth.response
  }

  try {
    const supabase = getAdminSupabaseClient()
    const result = await syncTwilioPhoneNumbers(supabase)
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/phone-numbers/sync:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}

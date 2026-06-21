import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireDeviceManagerUser } from '@/lib/api/device-manager-auth'
import { formatDeviceListItem } from '@/lib/api/devices-format'
import { getDevices } from '@/lib/database/devices'

export async function GET() {
  const auth = await requireDeviceManagerUser()
  if (!auth.ok) return auth.response

  try {
    const devicesData = await getDevices()
    const managerIds = [
      ...new Set(devicesData.map((item) => item.device.manager_id).filter(Boolean) as string[]),
    ]

    const managerProfiles = new Map<
      string,
      { name: string | null; profile_picture_url: string | null }
    >()

    if (managerIds.length > 0) {
      const supabase = await createClient()
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, profile_picture_url')
        .in('user_id', managerIds)

      if (profiles) {
        profiles.forEach((profile) => {
          managerProfiles.set(profile.user_id, {
            name: profile.name,
            profile_picture_url: profile.profile_picture_url,
          })
        })
      }
    }

    const devices = devicesData.map((item) => formatDeviceListItem(item, managerProfiles))

    return NextResponse.json({
      devices,
      currentUserId: auth.userId,
      userRole: auth.role,
    })
  } catch (error) {
    console.error('GET /api/devices:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list devices' },
      { status: 500 }
    )
  }
}

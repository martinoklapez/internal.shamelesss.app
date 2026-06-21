import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireDeviceManagerUser } from '@/lib/api/device-manager-auth'
import { formatDeviceDetailItem } from '@/lib/api/devices-format'
import { getDeviceById } from '@/lib/database/devices'
import {
  getPhoneNumberByICloudProfileId,
  getPhoneNumbersByIds,
} from '@/lib/database/phone-numbers'

interface RouteContext {
  params: Promise<{ deviceId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireDeviceManagerUser()
  if (!auth.ok) return auth.response

  const { deviceId: deviceIdParam } = await context.params
  const deviceId = parseInt(deviceIdParam, 10)
  if (Number.isNaN(deviceId)) {
    return NextResponse.json({ error: 'Invalid device id' }, { status: 400 })
  }

  try {
    const deviceData = await getDeviceById(deviceId)
    if (!deviceData) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    let managerName: string | null = null
    let managerProfilePicture: string | null = null

    if (deviceData.device.manager_id) {
      const supabase = await createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, profile_picture_url')
        .eq('user_id', deviceData.device.manager_id)
        .single()

      if (profile) {
        managerName = profile.name
        managerProfilePicture = profile.profile_picture_url
      }
    }

    const icloudPhone = deviceData.icloud_profile?.id
      ? await getPhoneNumberByICloudProfileId(deviceData.icloud_profile.id)
      : null

    const socialPhoneIds = deviceData.social_accounts
      .map((acc) => acc.phone_number_id)
      .filter((id): id is string => Boolean(id))
    const socialPhonesById = await getPhoneNumbersByIds(socialPhoneIds)

    const device = formatDeviceDetailItem(
      deviceData,
      managerName,
      managerProfilePicture,
      icloudPhone,
      socialPhonesById
    )

    return NextResponse.json({
      device,
      currentUserId: auth.userId,
    })
  } catch (error) {
    console.error(`GET /api/devices/${deviceIdParam}:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load device' },
      { status: 500 }
    )
  }
}

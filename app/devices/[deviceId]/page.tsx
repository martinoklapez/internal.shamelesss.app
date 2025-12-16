import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import DeviceDetails from '@/components/device-details'
import { getDeviceById } from '@/lib/database/devices'

interface DevicePageProps {
  params: {
    deviceId: string
  }
}

export default async function DevicePage({ params }: DevicePageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const deviceId = parseInt(params.deviceId, 10)
  if (isNaN(deviceId)) {
    notFound()
  }

  const deviceData = await getDeviceById(deviceId)

  if (!deviceData) {
    notFound()
  }

  // Fetch manager profile if manager exists
  let managerName: string | null = null
  let managerProfilePicture: string | null = null
  
  if (deviceData.device.manager_id) {
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

  // Transform database data to match component interface
  const device = {
    id: deviceData.device.id.toString(),
    name: deviceData.device.device_model,
    deviceType: deviceData.device.device_model as 'iPhone' | 'iPad',
    managerId: deviceData.device.manager_id || null,
    managerName: managerName,
    managerProfilePicture: managerProfilePicture,
    owner: deviceData.device.owner || null,
    iCloudProfile: deviceData.icloud_profile
      ? {
          id: deviceData.icloud_profile.id,
          email: deviceData.icloud_profile.email,
          credentials: deviceData.icloud_profile.credentials,
          alias: deviceData.icloud_profile.alias,
          birthDate: deviceData.icloud_profile.birth_date,
          country: deviceData.icloud_profile.country,
          street: deviceData.icloud_profile.street,
          city: deviceData.icloud_profile.city,
          zipCode: deviceData.icloud_profile.zip_code,
        }
      : null,
    archivedICloudProfiles: deviceData.archived_icloud_profiles.map((profile) => ({
      id: profile.id,
      email: profile.email,
      credentials: profile.credentials,
      alias: profile.alias,
      birthDate: profile.birth_date,
      country: profile.country,
      street: profile.street,
      city: profile.city,
      zipCode: profile.zip_code,
      batchId: profile.batch_id,
    })),
    socialAccounts: deviceData.social_accounts.map((acc) => ({
      id: acc.id,
      platform: acc.platform,
      username: acc.username,
      name: acc.name,
      credentials: acc.credentials,
    })),
    archivedSocialAccounts: deviceData.archived_social_accounts.map((acc) => ({
      id: acc.id,
      platform: acc.platform,
      username: acc.username,
      name: acc.name,
      credentials: acc.credentials,
      batchId: acc.batch_id,
    })),
    proxy: deviceData.proxy
      ? {
          id: deviceData.proxy.id,
          type: deviceData.proxy.type,
          host: deviceData.proxy.host,
          port: deviceData.proxy.port,
          username: deviceData.proxy.username,
          password: deviceData.proxy.password,
          api_address: deviceData.proxy.api_address,
          country: deviceData.proxy.country,
          city: deviceData.proxy.city,
          fraud_score: deviceData.proxy.fraud_score,
          asn: deviceData.proxy.asn,
          batch_id: deviceData.proxy.batch_id,
          status: deviceData.proxy.status,
          method: 'auto',
          plugin: 'none',
          tcpFastOpen: false,
          udpRelay: true,
        }
      : undefined,
    archivedProxies: deviceData.archived_proxies.map((proxy) => ({
      id: proxy.id,
      type: proxy.type,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      api_address: proxy.api_address,
      country: proxy.country,
      city: proxy.city,
      fraud_score: proxy.fraud_score,
      asn: proxy.asn,
      batch_id: proxy.batch_id,
      status: proxy.status,
      method: 'auto',
      plugin: 'none',
      tcpFastOpen: false,
      udpRelay: true,
    })),
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/devices">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white break-words">
                  {`Device ${device.id}`}
                </h1>
                <span className="px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 shrink-0">
                  {device.name}
                </span>
              </div>
              {device.iCloudProfile?.alias && (
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 break-words">
                  alias {device.iCloudProfile.alias}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm">
            {device.managerId && (device.managerName || device.managerProfilePicture) && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-400 font-semibold hidden sm:inline">Manager:</span>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-full">
                  {device.managerId === user.id ? (
                    <>
                      {device.managerProfilePicture ? (
                        <Image
                          src={device.managerProfilePicture}
                          alt="Me"
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                          M
                        </div>
                      )}
                      <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        Me
                      </span>
                    </>
                  ) : (
                    <>
                      {device.managerProfilePicture ? (
                        <Image
                          src={device.managerProfilePicture}
                          alt={device.managerName || 'Manager'}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                          {(device.managerName || 'M')[0].toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate max-w-[100px] sm:max-w-none">
                        {device.managerName || 'Manager'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
            {device.owner && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-400 font-semibold hidden sm:inline">Owner:</span>
                <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white break-words">
                  {device.owner}
                </span>
              </div>
            )}
          </div>
        </div>

        <DeviceDetails device={device} currentUserId={user.id} />
      </div>
    </div>
  )
}

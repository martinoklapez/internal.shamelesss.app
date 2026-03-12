import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDevices } from '@/lib/database/devices'
import { getUserRole } from '@/lib/user-roles'
import DevicesPageContent from '@/components/devices-page-content'

export default async function DevicesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const userRole = await getUserRole(user.id)
  const devicesData = await getDevices()

  // Get unique manager IDs
  const managerIds = [...new Set(devicesData.map(item => item.device.manager_id).filter(Boolean) as string[])]
  
  // Fetch manager profiles
  const managerProfiles = new Map<string, { name: string | null; profile_picture_url: string | null }>()
  if (managerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name, profile_picture_url')
      .in('user_id', managerIds)
    
    if (profiles) {
      profiles.forEach(profile => {
        managerProfiles.set(profile.user_id, {
          name: profile.name,
          profile_picture_url: profile.profile_picture_url,
        })
      })
    }
  }

  // Transform database data to match component interface
  const devices = devicesData.map((item) => {
    const managerProfile = item.device.manager_id ? managerProfiles.get(item.device.manager_id) : null
    
    return {
      id: item.device.id.toString(),
      name: item.device.device_model, // Use device_model as name for display
      deviceType: item.device.device_model as 'iPhone' | 'iPad',
      managerId: item.device.manager_id || null,
      managerName: managerProfile?.name || null,
      managerProfilePicture: managerProfile?.profile_picture_url || null,
      owner: item.device.owner || null,
      iCloudProfile: item.icloud_profile
        ? {
            email: item.icloud_profile.email,
            credentials: item.icloud_profile.credentials,
            alias: item.icloud_profile.alias,
            birthDate: item.icloud_profile.birth_date,
            country: item.icloud_profile.country,
            street: item.icloud_profile.street,
            city: item.icloud_profile.city,
            zipCode: item.icloud_profile.zip_code,
          }
        : null,
      socialAccounts: item.social_accounts.map((acc) => ({
        id: acc.id,
        platform: acc.platform,
        username: acc.username,
        name: acc.name,
        credentials: acc.credentials,
        status: acc.status,
      })),
      proxy: item.proxy
        ? {
            country: item.proxy.country,
          }
        : null,
    }
  }) // Show all devices, even without iCloud profiles

  return (
    <div className="flex min-h-screen w-full min-w-0 max-w-full flex-col overflow-hidden bg-white">
      <div className="flex flex-1 flex-col min-h-0 min-w-0 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<div className="flex min-h-0 flex-1 items-center justify-center text-gray-500">Loading...</div>}>
          <DevicesPageContent devices={devices} currentUserId={user.id} userRole={userRole} />
        </Suspense>
      </div>
    </div>
  )
}


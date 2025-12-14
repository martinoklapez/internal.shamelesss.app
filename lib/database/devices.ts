import { createClient } from '@/lib/supabase/server'

export interface Device {
  id: number
  device_model: string
  manager_id: string | null
  owner: string | null
  created_at: string
  updated_at: string
}

export interface ICloudProfile {
  id: string
  device_id: number
  email: string
  credentials: string
  alias: string
  birth_date: string
  country: string
  street: string
  city: string
  zip_code: string
  status: 'active' | 'archived'
  batch_id: string | null
  created_at: string
  updated_at: string
}

export interface SocialAccount {
  id: string
  device_id: number
  platform: 'TikTok' | 'Instagram' | 'Snapchat'
  username: string
  name: string | null
  credentials: string
  status: 'draft' | 'active' | 'archived'
  batch_id: string | null
  created_at: string
  updated_at: string
}

export interface Proxy {
  id: string
  device_id: number
  type: 'HTTP' | 'SOCKS5' | 'SOCKS4'
  host: string
  port: number
  username: string | null
  password: string | null
  api_address: string | null
  country: string | null
  city: string | null
  fraud_score: number | null
  asn: string | null
  batch_id: string | null
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
}

export interface DeviceWithRelations {
  device: Device
  icloud_profile: ICloudProfile | null
  archived_icloud_profiles: ICloudProfile[]
  social_accounts: SocialAccount[]
  archived_social_accounts: SocialAccount[]
  proxy: Proxy | null
  archived_proxies: Proxy[]
}

/**
 * Get all devices with their iCloud profiles and social accounts
 */
export async function getDevices(): Promise<DeviceWithRelations[]> {
  const supabase = await createClient()

  // Fetch all devices (using public view that points to internal.devices)
  const { data: devices, error: devicesError } = await supabase
    .from('devices')
    .select('*')
    .order('id', { ascending: true })

  if (devicesError) {
    throw new Error(`Failed to fetch devices: ${devicesError.message}`)
  }

  if (!devices || devices.length === 0) {
    return []
  }

  const deviceIds = devices.map((d) => d.id)

  // Fetch all iCloud profiles (using public view) - both active and archived
  const { data: icloudProfiles, error: icloudError } = await supabase
    .from('icloud_profiles')
    .select('*')
    .in('device_id', deviceIds)
    .order('created_at', { ascending: false })

  if (icloudError) {
    throw new Error(`Failed to fetch iCloud profiles: ${icloudError.message}`)
  }

  // Fetch all social accounts (using public view)
  const { data: socialAccounts, error: socialError } = await supabase
    .from('social_accounts')
    .select('*')
    .in('device_id', deviceIds)

  if (socialError) {
    throw new Error(`Failed to fetch social accounts: ${socialError.message}`)
  }

  // Fetch all proxies (using public view)
  const { data: proxies, error: proxiesError } = await supabase
    .from('proxies')
    .select('*')
    .in('device_id', deviceIds)

  if (proxiesError) {
    throw new Error(`Failed to fetch proxies: ${proxiesError.message}`)
  }

  // Combine the data
  return devices.map((device) => {
    const deviceProfiles = (icloudProfiles?.filter((p) => p.device_id === device.id) as ICloudProfile[]) || []
    const activeProfile = deviceProfiles.find((p) => p.status === 'active') || null
    const archivedProfiles = deviceProfiles.filter((p) => p.status === 'archived')
    
    const deviceSocialAccounts = (socialAccounts?.filter((a) => a.device_id === device.id) as SocialAccount[]) || []
    const activeSocialAccounts = deviceSocialAccounts.filter((a) => a.status === 'active' || a.status === 'draft')
    const archivedSocialAccounts = deviceSocialAccounts.filter((a) => a.status === 'archived')
    
    const deviceProxies = (proxies?.filter((p) => p.device_id === device.id) as Proxy[]) || []
    const activeProxy = deviceProxies.find((p) => p.status === 'active') || null
    const archivedProxies = deviceProxies.filter((p) => p.status === 'archived')
    
    return {
      device: device as Device,
      icloud_profile: activeProfile,
      archived_icloud_profiles: archivedProfiles,
      social_accounts: activeSocialAccounts,
      archived_social_accounts: archivedSocialAccounts,
      proxy: activeProxy,
      archived_proxies: archivedProxies,
    }
  })
}

/**
 * Get a single device by ID with its iCloud profile and social accounts
 */
export async function getDeviceById(deviceId: number): Promise<DeviceWithRelations | null> {
  const supabase = await createClient()

  // Fetch the device (using public view)
  const { data: device, error: deviceError } = await supabase
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .single()

  if (deviceError || !device) {
    return null
  }

  // Fetch all iCloud profiles (using public view) - both active and archived
  const { data: icloudProfiles } = await supabase
    .from('icloud_profiles')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })

  // Fetch social accounts (using public view)
  const { data: socialAccounts } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: true })

  // Fetch all proxies (using public view) - including archived ones
  const { data: proxies } = await supabase
    .from('proxies')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })

  const profiles = (icloudProfiles as ICloudProfile[]) || []
  const activeProfile = profiles.find((p) => p.status === 'active') || null
  const archivedProfiles = profiles.filter((p) => p.status === 'archived')

  const allSocialAccounts = (socialAccounts as SocialAccount[]) || []
  const activeSocialAccounts = allSocialAccounts.filter((a) => a.status === 'active' || a.status === 'draft')
  const archivedSocialAccounts = allSocialAccounts.filter((a) => a.status === 'archived')

  // Get the active and archived proxies
  const allProxies = (proxies as Proxy[]) || []
  const activeProxy = allProxies.find((p) => p.status === 'active') || null
  const archivedProxies = allProxies.filter((p) => p.status === 'archived')

  return {
    device: device as Device,
    icloud_profile: activeProfile,
    archived_icloud_profiles: archivedProfiles,
    social_accounts: activeSocialAccounts,
    archived_social_accounts: archivedSocialAccounts,
    proxy: activeProxy,
    archived_proxies: archivedProxies,
  }
}


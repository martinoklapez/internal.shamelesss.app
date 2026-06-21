import type { DeviceWithRelations, SocialAccountStatus } from '@/lib/database/devices'

export interface DeviceListItem {
  id: string
  name: string
  deviceType: 'iPhone' | 'iPad'
  managerId: string | null
  managerName: string | null
  managerProfilePicture: string | null
  owner: string | null
  iCloudProfile: {
    email: string
    credentials: string
    alias: string
    birthDate: string
    country: string
    street: string
    city: string
    zipCode: string
  } | null
  socialAccounts: Array<{
    id: string
    platform: 'TikTok' | 'Instagram' | 'Snapchat' | 'Pinterest'
    username: string
    name: string | null
    credentials: string
    status: SocialAccountStatus
  }>
  proxy: { country: string | null } | null
}

export interface DevicePhoneSummary {
  id: string
  e164: string
  friendly_name: string | null
}

export interface DeviceDetailItem {
  id: string
  name: string
  deviceType: 'iPhone' | 'iPad'
  managerId: string | null
  managerName: string | null
  managerProfilePicture: string | null
  owner: string | null
  iCloudProfile: {
    id: string
    email: string
    credentials: string
    alias: string
    birthDate: string
    country: string
    street: string
    city: string
    zipCode: string
    phoneNumber: DevicePhoneSummary | null
  } | null
  archivedICloudProfiles: Array<{
    id: string
    email: string
    credentials: string
    alias: string
    birthDate: string
    country: string
    street: string
    city: string
    zipCode: string
    batchId: string | null
  }>
  socialAccounts: Array<{
    id: string
    platform: 'TikTok' | 'Instagram' | 'Snapchat' | 'Pinterest'
    username: string
    name: string | null
    credentials: string
    status: SocialAccountStatus
    phoneNumber: DevicePhoneSummary | null
  }>
  archivedSocialAccounts: Array<{
    id: string
    platform: 'TikTok' | 'Instagram' | 'Snapchat' | 'Pinterest'
    username: string
    name: string | null
    credentials: string
    batchId: string | null
    status: SocialAccountStatus
  }>
  proxy?: {
    id: string
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
    method: string
    plugin: string
    tcpFastOpen: boolean
    udpRelay: boolean
  }
  archivedProxies: Array<{
    id: string
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
    method: string
    plugin: string
    tcpFastOpen: boolean
    udpRelay: boolean
  }>
}

export interface TransferDeviceOption {
  id: string
  name: string
  managerId: string | null
  managerName: string
  managerProfilePicture: string | null
  iCloudAlias: string | null
  iCloudCountry: string | null
  proxyCountry: string | null
}

type ManagerProfile = { name: string | null; profile_picture_url: string | null }

function toPhoneSummary(phone: { id: string; e164: string; friendly_name: string | null }): DevicePhoneSummary {
  return {
    id: phone.id,
    e164: phone.e164,
    friendly_name: phone.friendly_name,
  }
}

function formatProxy(proxy: DeviceWithRelations['proxy']) {
  if (!proxy) return undefined
  return {
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
  }
}

export function formatDeviceListItem(
  item: DeviceWithRelations,
  managerProfiles: Map<string, ManagerProfile>
): DeviceListItem {
  const managerProfile = item.device.manager_id ? managerProfiles.get(item.device.manager_id) : null

  return {
    id: item.device.id.toString(),
    name: item.device.device_model,
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
    proxy: item.proxy ? { country: item.proxy.country } : null,
  }
}

export function formatDeviceDetailItem(
  item: DeviceWithRelations,
  managerName: string | null,
  managerProfilePicture: string | null,
  icloudPhone: { id: string; e164: string; friendly_name: string | null } | null,
  socialPhonesById: Map<string, { id: string; e164: string; friendly_name: string | null }>
): DeviceDetailItem {
  return {
    id: item.device.id.toString(),
    name: item.device.device_model,
    deviceType: item.device.device_model as 'iPhone' | 'iPad',
    managerId: item.device.manager_id || null,
    managerName,
    managerProfilePicture,
    owner: item.device.owner || null,
    iCloudProfile: item.icloud_profile
      ? {
          id: item.icloud_profile.id,
          email: item.icloud_profile.email,
          credentials: item.icloud_profile.credentials,
          alias: item.icloud_profile.alias,
          birthDate: item.icloud_profile.birth_date,
          country: item.icloud_profile.country,
          street: item.icloud_profile.street,
          city: item.icloud_profile.city,
          zipCode: item.icloud_profile.zip_code,
          phoneNumber: icloudPhone ? toPhoneSummary(icloudPhone) : null,
        }
      : null,
    archivedICloudProfiles: item.archived_icloud_profiles.map((profile) => ({
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
    socialAccounts: item.social_accounts.map((acc) => ({
      id: acc.id,
      platform: acc.platform,
      username: acc.username,
      name: acc.name,
      credentials: acc.credentials,
      status: acc.status,
      phoneNumber: acc.phone_number_id && socialPhonesById.get(acc.phone_number_id)
        ? toPhoneSummary(socialPhonesById.get(acc.phone_number_id)!)
        : null,
    })),
    archivedSocialAccounts: item.archived_social_accounts.map((acc) => ({
      id: acc.id,
      platform: acc.platform,
      username: acc.username,
      name: acc.name,
      credentials: acc.credentials,
      batchId: acc.batch_id,
      status: acc.status,
    })),
    proxy: formatProxy(item.proxy),
    archivedProxies: item.archived_proxies.map((proxy) => formatProxy(proxy)!),
  }
}

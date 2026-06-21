import { createClient } from '@/lib/supabase/server'
import type { TransferDeviceOption } from '@/lib/api/devices-format'

export async function getTransferDeviceOptions(): Promise<TransferDeviceOption[]> {
  const supabase = await createClient()

  const { data: allDevicesData } = await supabase
    .from('devices')
    .select('id, device_model, manager_id')
    .order('id', { ascending: true })

  const allDeviceIds = (allDevicesData || []).map((item) => item.id)
  const allManagerIds = Array.from(
    new Set(
      (allDevicesData || [])
        .map((item) => item.manager_id)
        .filter((id): id is string => Boolean(id))
    )
  )

  const { data: managerProfiles } = allManagerIds.length
    ? await supabase
        .from('profiles')
        .select('user_id, name, profile_picture_url')
        .in('user_id', allManagerIds)
    : { data: [] as Array<{ user_id: string; name: string | null; profile_picture_url: string | null }> }

  const managerMetaById = new Map<string, { name: string; profilePicture: string | null }>()
  ;(managerProfiles || []).forEach((profile) => {
    managerMetaById.set(profile.user_id, {
      name: profile.name || profile.user_id,
      profilePicture: profile.profile_picture_url || null,
    })
  })

  const { data: activeICloudProfiles } = allDeviceIds.length
    ? await supabase
        .from('icloud_profiles')
        .select('device_id, alias, country')
        .eq('status', 'active')
        .in('device_id', allDeviceIds)
    : { data: [] as Array<{ device_id: number; alias: string | null; country: string | null }> }

  const activeICloudByDeviceId = new Map<number, { alias: string | null; country: string | null }>()
  ;(activeICloudProfiles || []).forEach((item) => {
    activeICloudByDeviceId.set(item.device_id, { alias: item.alias, country: item.country })
  })

  const { data: activeProxies } = allDeviceIds.length
    ? await supabase
        .from('proxies')
        .select('device_id, country')
        .eq('status', 'active')
        .in('device_id', allDeviceIds)
    : { data: [] as Array<{ device_id: number; country: string | null }> }

  const activeProxyCountryByDeviceId = new Map<number, string | null>()
  ;(activeProxies || []).forEach((item) => {
    activeProxyCountryByDeviceId.set(item.device_id, item.country)
  })

  return (
    allDevicesData?.map((item) => {
      const iCloud = activeICloudByDeviceId.get(item.id)
      const managerMeta =
        item.manager_id != null
          ? managerMetaById.get(item.manager_id) || { name: item.manager_id, profilePicture: null }
          : { name: 'Unassigned', profilePicture: null }

      return {
        id: String(item.id),
        name: item.device_model || `Device ${item.id}`,
        managerId: item.manager_id,
        managerName: managerMeta.name,
        managerProfilePicture: managerMeta.profilePicture,
        iCloudAlias: iCloud?.alias ?? null,
        iCloudCountry: iCloud?.country ?? null,
        proxyCountry: activeProxyCountryByDeviceId.get(item.id) ?? null,
      }
    }) || []
  )
}

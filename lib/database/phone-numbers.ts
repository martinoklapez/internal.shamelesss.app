import { createClient } from '@/lib/supabase/server'

export type PhoneNumberStatus = 'active' | 'reserved' | 'released'
export type PhoneNumberPurpose = 'tiktok_signup' | 'instagram_signup' | 'general'
export type SmsDirection = 'inbound' | 'outbound'
export type SmsStatus = 'received' | 'queued' | 'sent' | 'delivered' | 'failed'

export interface PhoneNumber {
  id: string
  e164: string
  twilio_sid: string | null
  friendly_name: string | null
  country: string | null
  status: PhoneNumberStatus
  icloud_profile_id: string | null
  assigned_user_id: string | null
  purpose: PhoneNumberPurpose
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SmsMessage {
  id: string
  phone_number_id: string
  direction: SmsDirection
  from_e164: string
  to_e164: string
  body: string
  twilio_message_sid: string | null
  status: SmsStatus
  read_at: string | null
  created_at: string
}

export interface PhoneNumberSocialAccount {
  id: string
  platform: string
  username: string
  device_id: number
}

export interface PhoneNumberICloudLink {
  id: string
  alias: string
  email: string
  device_id: number
}

export interface PhoneNumberAssignmentContext {
  icloud: PhoneNumberICloudLink | null
  social_accounts: PhoneNumberSocialAccount[]
  /** Devices inferred from linked iCloud / social accounts (not stored on phone). */
  devices: Array<{
    id: number
    device_model: string | null
    owner: string | null
    manager_id: string | null
    manager_name: string | null
    manager_profile_picture: string | null
  }>
}

export interface PhoneNumberWithMeta extends PhoneNumber {
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
  assignment: PhoneNumberAssignmentContext
  assigned_user_name: string | null
  assigned_user_profile_picture: string | null
}

interface ICloudRow {
  id: string
  device_id: number
  email: string
  alias: string
}

interface SocialRow {
  id: string
  device_id: number
  platform: string
  username: string
  phone_number_id: string | null
}

interface DeviceRow {
  id: number
  device_model: string
  manager_id: string | null
  owner: string | null
}

function emptyAssignment(): PhoneNumberAssignmentContext {
  return { icloud: null, social_accounts: [], devices: [] }
}

function buildAssignmentForPhone(
  phone: PhoneNumber,
  icloudById: Map<string, ICloudRow>,
  socialByPhoneId: Map<string, SocialRow[]>,
  devicesById: Map<number, DeviceRow>,
  managersById: Map<string, { name: string | null; profile_picture_url: string | null }>
): PhoneNumberAssignmentContext {
  const assignment = emptyAssignment()

  if (phone.icloud_profile_id) {
    const icloud = icloudById.get(phone.icloud_profile_id)
    if (icloud) {
      assignment.icloud = {
        id: icloud.id,
        alias: icloud.alias,
        email: icloud.email,
        device_id: icloud.device_id,
      }
    }
  }

  const socials = socialByPhoneId.get(phone.id) ?? []
  assignment.social_accounts = socials.map((s) => ({
    id: s.id,
    platform: s.platform,
    username: s.username,
    device_id: s.device_id,
  }))

  const deviceIds = new Set<number>()
  if (assignment.icloud) deviceIds.add(assignment.icloud.device_id)
  for (const s of assignment.social_accounts) deviceIds.add(s.device_id)

  assignment.devices = [...deviceIds].map((deviceId) => {
    const device = devicesById.get(deviceId)
    const manager = device?.manager_id ? managersById.get(device.manager_id) : null
    return {
      id: deviceId,
      device_model: device?.device_model ?? null,
      owner: device?.owner ?? null,
      manager_id: device?.manager_id ?? null,
      manager_name: manager?.name ?? null,
      manager_profile_picture: manager?.profile_picture_url ?? null,
    }
  })

  return assignment
}

export async function listPhoneNumbers(): Promise<PhoneNumberWithMeta[]> {
  const supabase = await createClient()

  const { data: numbers, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .order('e164', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch phone numbers: ${error.message}`)
  }

  if (!numbers?.length) return []

  const typedNumbers = numbers as PhoneNumber[]
  const ids = typedNumbers.map((n) => n.id)
  const icloudIds = [
    ...new Set(
      typedNumbers.map((n) => n.icloud_profile_id).filter((id): id is string => Boolean(id))
    ),
  ]

  const [{ data: socialAccounts }, { data: icloudProfiles }, { data: messages, error: msgError }] =
    await Promise.all([
      supabase
        .from('social_accounts')
        .select('id, device_id, platform, username, phone_number_id')
        .in('phone_number_id', ids)
        .neq('status', 'archived'),
      icloudIds.length
        ? supabase
            .from('icloud_profiles')
            .select('id, device_id, email, alias')
            .in('id', icloudIds)
        : Promise.resolve({ data: [] as ICloudRow[] }),
      supabase
        .from('sms_messages')
        .select('phone_number_id, body, created_at, direction, read_at')
        .in('phone_number_id', ids)
        .order('created_at', { ascending: false }),
    ])

  if (msgError) {
    throw new Error(`Failed to fetch SMS metadata: ${msgError.message}`)
  }

  const socialByPhoneId = new Map<string, SocialRow[]>()
  const deviceIdSet = new Set<number>()

  for (const account of (socialAccounts ?? []) as SocialRow[]) {
    if (!account.phone_number_id) continue
    const list = socialByPhoneId.get(account.phone_number_id) ?? []
    list.push(account)
    socialByPhoneId.set(account.phone_number_id, list)
    deviceIdSet.add(account.device_id)
  }

  const icloudById = new Map<string, ICloudRow>()
  for (const profile of (icloudProfiles ?? []) as ICloudRow[]) {
    icloudById.set(profile.id, profile)
    deviceIdSet.add(profile.device_id)
  }

  const deviceIds = [...deviceIdSet]
  const { data: devices } = deviceIds.length
    ? await supabase
        .from('devices')
        .select('id, device_model, manager_id, owner')
        .in('id', deviceIds)
    : { data: [] as DeviceRow[] }

  const managerIds = [
    ...new Set(
      (devices ?? []).map((d) => d.manager_id).filter((id): id is string => Boolean(id))
    ),
  ]

  const assigneeIds = [
    ...new Set(
      typedNumbers.map((n) => n.assigned_user_id).filter((id): id is string => Boolean(id))
    ),
  ]

  const profileUserIds = [...new Set([...managerIds, ...assigneeIds])]

  const { data: managerProfiles } = profileUserIds.length
    ? await supabase
        .from('profiles')
        .select('user_id, name, profile_picture_url')
        .in('user_id', profileUserIds)
    : { data: [] as Array<{ user_id: string; name: string | null; profile_picture_url: string | null }> }

  const devicesById = new Map<number, DeviceRow>()
  for (const device of (devices ?? []) as DeviceRow[]) {
    devicesById.set(device.id, device)
  }

  const managersById = new Map<
    string,
    { name: string | null; profile_picture_url: string | null }
  >()
  for (const profile of managerProfiles ?? []) {
    managersById.set(profile.user_id, {
      name: profile.name,
      profile_picture_url: profile.profile_picture_url,
    })
  }

  const lastByPhone = new Map<string, { body: string; created_at: string }>()
  const unreadByPhone = new Map<string, number>()

  for (const msg of messages ?? []) {
    if (!lastByPhone.has(msg.phone_number_id)) {
      lastByPhone.set(msg.phone_number_id, {
        body: msg.body,
        created_at: msg.created_at,
      })
    }
    if (msg.direction === 'inbound' && !msg.read_at) {
      unreadByPhone.set(
        msg.phone_number_id,
        (unreadByPhone.get(msg.phone_number_id) ?? 0) + 1
      )
    }
  }

  return typedNumbers.map((n) => {
    const last = lastByPhone.get(n.id)
    const assignee = n.assigned_user_id ? managersById.get(n.assigned_user_id) : null
    return {
      ...n,
      unread_count: unreadByPhone.get(n.id) ?? 0,
      last_message_at: last?.created_at ?? null,
      last_message_preview: last?.body ?? null,
      assignment: buildAssignmentForPhone(
        n,
        icloudById,
        socialByPhoneId,
        devicesById,
        managersById
      ),
      assigned_user_name: assignee?.name ?? null,
      assigned_user_profile_picture: assignee?.profile_picture_url ?? null,
    }
  })
}

export async function listSmsMessages(
  phoneNumberId: string,
  limit = 100
): Promise<SmsMessage[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`)
  }

  return (data as SmsMessage[]) ?? []
}

export async function getPhoneNumberByICloudProfileId(
  icloudProfileId: string
): Promise<PhoneNumber | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('icloud_profile_id', icloudProfileId)
    .neq('status', 'released')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch phone number: ${error.message}`)
  }

  return (data as PhoneNumber) ?? null
}

export async function getPhoneNumbersByIds(ids: string[]): Promise<Map<string, PhoneNumber>> {
  if (!ids.length) return new Map()

  const supabase = await createClient()
  const { data, error } = await supabase.from('phone_numbers').select('*').in('id', ids)

  if (error) {
    throw new Error(`Failed to fetch phone numbers: ${error.message}`)
  }

  const map = new Map<string, PhoneNumber>()
  for (const row of (data ?? []) as PhoneNumber[]) {
    map.set(row.id, row)
  }
  return map
}

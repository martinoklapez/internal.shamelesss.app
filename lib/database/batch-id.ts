import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

/**
 * Get or create a batch_id for a device
 * Priority order:
 * 1. Active iCloud profile's batch_id (if exists)
 * 2. Active proxy's batch_id (if exists)
 * 3. Active/draft social account's batch_id (most recent, if exists)
 * 4. Generate a new UUID
 */
export async function getOrCreateBatchId(deviceId: number): Promise<string> {
  const supabase = await createClient()

  // Priority 1: Check if device has an active iCloud profile with a batch_id
  const { data: activeProfile } = await supabase
    .from('icloud_profiles')
    .select('batch_id')
    .eq('device_id', deviceId)
    .eq('status', 'active')
    .single()

  if (activeProfile?.batch_id) {
    return activeProfile.batch_id
  }

  // Priority 2: Check if device has an active proxy with a batch_id
  const { data: activeProxy } = await supabase
    .from('proxies')
    .select('batch_id')
    .eq('device_id', deviceId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (activeProxy?.batch_id) {
    return activeProxy.batch_id
  }

  // Priority 3: Check if device has active/draft social accounts with a batch_id (most recent)
  const { data: socialAccount } = await supabase
    .from('social_accounts')
    .select('batch_id')
    .eq('device_id', deviceId)
    .in('status', ['active', 'draft'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (socialAccount?.batch_id) {
    return socialAccount.batch_id
  }

  // Priority 4: Generate a new batch_id
  return randomUUID()
}


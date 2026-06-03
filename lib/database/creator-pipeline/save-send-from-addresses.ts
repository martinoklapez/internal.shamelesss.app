import type { SupabaseClient } from '@supabase/supabase-js'
import type { SendFromAddress } from '@/lib/creator-outreach/types'
import { creatorPipelineDb } from './client'
import { mapSendFromAddressRow, sendFromAddressToRow } from './mappers'
import type { SendFromAddressRow } from './rows'

export type SaveSendFromAddressInput = {
  id: string
  address: string
  displayName: string
  missiveAccountId?: string
  signatureHtml?: string
  enabled: boolean
  isDefault: boolean
}

function validateInput(input: SaveSendFromAddressInput): void {
  const address = input.address.trim().toLowerCase()
  if (!address || !address.includes('@')) {
    throw new Error('A valid email address is required')
  }
}

async function loadAllSendFromAddresses(
  db: ReturnType<typeof creatorPipelineDb>
): Promise<SendFromAddress[]> {
  const { data, error } = await db
    .from('send_from_addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('address', { ascending: true })

  if (error) {
    throw new Error(`Failed to load send-from addresses: ${error.message}`)
  }

  return (data as SendFromAddressRow[]).map(mapSendFromAddressRow)
}

export async function saveSendFromAddressInDb(
  supabase: SupabaseClient,
  input: SaveSendFromAddressInput
): Promise<SendFromAddress[]> {
  validateInput(input)
  const db = creatorPipelineDb(supabase)

  const { data: existing, error: existingError } = await db
    .from('send_from_addresses')
    .select('id, created_at')
    .eq('id', input.id)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to load sender: ${existingError.message}`)
  }

  if (input.isDefault) {
    const { error: clearDefaultError } = await db
      .from('send_from_addresses')
      .update({ is_default: false })
      .neq('id', input.id)

    if (clearDefaultError) {
      throw new Error(`Failed to update default sender: ${clearDefaultError.message}`)
    }
  } else if (!existing) {
    const { count, error: countError } = await db
      .from('send_from_addresses')
      .select('id', { count: 'exact', head: true })

    if (countError) {
      throw new Error(`Failed to count senders: ${countError.message}`)
    }

    if ((count ?? 0) === 0) {
      input = { ...input, isDefault: true }
    }
  }

  const row = sendFromAddressToRow({
    id: input.id,
    address: input.address.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    missiveAccountId: input.missiveAccountId?.trim() || undefined,
    signatureHtml: input.signatureHtml?.trim() || undefined,
    enabled: input.enabled,
    isDefault: input.isDefault,
  })

  if (existing?.created_at) {
    row.created_at = existing.created_at as string
  }

  const { error: saveError } = await db.from('send_from_addresses').upsert(row)
  if (saveError) {
    throw new Error(`Failed to save send-from address: ${saveError.message}`)
  }

  return loadAllSendFromAddresses(db)
}

export async function deleteSendFromAddressInDb(
  supabase: SupabaseClient,
  addressId: string
): Promise<SendFromAddress[]> {
  const db = creatorPipelineDb(supabase)

  const { data: row, error: loadError } = await db
    .from('send_from_addresses')
    .select('id, address')
    .eq('id', addressId)
    .maybeSingle()

  if (loadError) {
    throw new Error(`Failed to load sender: ${loadError.message}`)
  }
  if (!row) {
    throw new Error('Sender not found')
  }

  const { count: ruleCount, error: rulesError } = await db
    .from('outreach_rules')
    .select('id', { count: 'exact', head: true })
    .eq('send_from_id', addressId)
    .eq('action', 'send_email')

  if (rulesError) {
    throw new Error(`Failed to check outreach rules: ${rulesError.message}`)
  }
  if ((ruleCount ?? 0) > 0) {
    throw new Error(
      'Cannot delete this sender while outreach rules still reference it. Update rules first.'
    )
  }

  const { error: deleteError } = await db.from('send_from_addresses').delete().eq('id', addressId)
  if (deleteError) {
    throw new Error(`Failed to delete sender: ${deleteError.message}`)
  }

  const remaining = await loadAllSendFromAddresses(db)
  if (remaining.length > 0 && !remaining.some((s) => s.isDefault)) {
    const nextDefault = remaining[0]
    const { error: defaultError } = await db
      .from('send_from_addresses')
      .update({ is_default: true })
      .eq('id', nextDefault.id)

    if (defaultError) {
      throw new Error(`Failed to set default sender: ${defaultError.message}`)
    }

    return loadAllSendFromAddresses(db)
  }

  return remaining
}

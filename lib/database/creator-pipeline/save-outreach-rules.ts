import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreatorContactKind,
  OutreachRule,
  OutreachRuleAction,
} from '@/lib/creator-outreach/types'
import { creatorPipelineDb } from './client'
import { mapOutreachRuleRow, outreachRuleToRow } from './mappers'
import type { OutreachRuleRow } from './rows'

export type SaveOutreachRuleInput = {
  contactKind: CreatorContactKind
  enabled: boolean
  action: OutreachRuleAction
  templateId: string | null
  sendFromId: string | null
}

export async function saveOutreachRulesInDb(
  supabase: SupabaseClient,
  inputs: SaveOutreachRuleInput[]
): Promise<OutreachRule[]> {
  const db = creatorPipelineDb(supabase)
  const now = new Date().toISOString()

  const { data: existing, error: loadError } = await db.from('outreach_rules').select('*')
  if (loadError) {
    throw new Error(`Failed to load outreach rules: ${loadError.message}`)
  }

  const byKind = new Map(
    (existing ?? []).map((row) => [row.contact_kind as CreatorContactKind, row])
  )

  const rows = inputs.map((input) => {
    const prev = byKind.get(input.contactKind)
    if (input.action === 'send_email' && !input.templateId) {
      throw new Error(`Template required to send email for ${input.contactKind}`)
    }
    if (input.action === 'do_not_send' && input.templateId) {
      throw new Error(`Template must be empty when not sending for ${input.contactKind}`)
    }
    if (input.action === 'send_email' && !input.sendFromId) {
      throw new Error(`Send-from address required for ${input.contactKind}`)
    }
    if (input.action === 'do_not_send' && input.sendFromId) {
      throw new Error(`Send-from must be empty when not sending for ${input.contactKind}`)
    }

    return outreachRuleToRow({
      id: (prev?.id as string) ?? crypto.randomUUID(),
      enabled: input.enabled,
      trigger: 'contact_email_ready',
      contactKind: input.contactKind,
      action: input.action,
      templateId: input.action === 'send_email' ? input.templateId : null,
      sendFromId: input.action === 'send_email' ? input.sendFromId : null,
      createdAt: (prev?.created_at as string) ?? now,
      updatedAt: now,
    })
  })

  for (const input of inputs) {
    if (input.action === 'send_email' && input.templateId) {
      const { data: tpl, error: tplError } = await db
        .from('email_templates')
        .select('id')
        .eq('id', input.templateId)
        .maybeSingle()
      if (tplError) throw new Error(tplError.message)
      if (!tpl) throw new Error(`Template not found for ${input.contactKind}`)
    }
    if (input.action === 'send_email' && input.sendFromId) {
      const { data: sender, error: senderError } = await db
        .from('send_from_addresses')
        .select('id, enabled')
        .eq('id', input.sendFromId)
        .maybeSingle()
      if (senderError) throw new Error(senderError.message)
      if (!sender || !sender.enabled) {
        throw new Error(`Send-from address not found or disabled for ${input.contactKind}`)
      }
    }
  }

  const { error: saveError } = await db.from('outreach_rules').upsert(rows)
  if (saveError) {
    throw new Error(`Failed to save outreach rules: ${saveError.message}`)
  }

  const { data: saved, error: reloadError } = await db
    .from('outreach_rules')
    .select('*')
    .order('contact_kind', { ascending: true })

  if (reloadError) {
    throw new Error(`Failed to reload outreach rules: ${reloadError.message}`)
  }

  return (saved as OutreachRuleRow[]).map(mapOutreachRuleRow)
}

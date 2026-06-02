import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmailTemplate } from '@/lib/creator-outreach/types'
import { creatorPipelineDb } from './client'
import { mapTemplateRow, templateToRow } from './mappers'
import type { EmailTemplateRow } from './rows'

export type SaveEmailTemplateInput = {
  id: string
  name: string
  subject: string
  bodyPreview: string
  isDefault: boolean
}

function validateTemplateInput(input: SaveEmailTemplateInput): void {
  if (!input.name.trim()) {
    throw new Error('Template name is required')
  }
  if (!input.subject.trim()) {
    throw new Error('Subject is required')
  }
  if (!input.bodyPreview.trim()) {
    throw new Error('Email body is required')
  }
}

async function loadAllTemplates(db: ReturnType<typeof creatorPipelineDb>): Promise<EmailTemplate[]> {
  const { data, error } = await db
    .from('email_templates')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to load email templates: ${error.message}`)
  }

  return (data as EmailTemplateRow[]).map(mapTemplateRow)
}

export async function saveEmailTemplateInDb(
  supabase: SupabaseClient,
  input: SaveEmailTemplateInput
): Promise<EmailTemplate[]> {
  validateTemplateInput(input)
  const db = creatorPipelineDb(supabase)

  const { data: existing, error: existingError } = await db
    .from('email_templates')
    .select('id, created_at')
    .eq('id', input.id)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to load template: ${existingError.message}`)
  }

  if (input.isDefault) {
    const { error: clearDefaultError } = await db
      .from('email_templates')
      .update({ is_default: false })
      .neq('id', input.id)

    if (clearDefaultError) {
      throw new Error(`Failed to update default template: ${clearDefaultError.message}`)
    }
  } else if (!existing) {
    const { count, error: countError } = await db
      .from('email_templates')
      .select('id', { count: 'exact', head: true })

    if (countError) {
      throw new Error(`Failed to count templates: ${countError.message}`)
    }

    if ((count ?? 0) === 0) {
      input = { ...input, isDefault: true }
    }
  }

  const row = templateToRow({
    id: input.id,
    name: input.name.trim(),
    subject: input.subject.trim(),
    bodyPreview: input.bodyPreview.trim(),
    isDefault: input.isDefault,
  })

  if (existing?.created_at) {
    row.created_at = existing.created_at as string
  }

  const { error: saveError } = await db.from('email_templates').upsert(row)
  if (saveError) {
    throw new Error(`Failed to save email template: ${saveError.message}`)
  }

  return loadAllTemplates(db)
}

export async function deleteEmailTemplateInDb(
  supabase: SupabaseClient,
  templateId: string
): Promise<EmailTemplate[]> {
  const db = creatorPipelineDb(supabase)

  const { data: template, error: templateError } = await db
    .from('email_templates')
    .select('id, name')
    .eq('id', templateId)
    .maybeSingle()

  if (templateError) {
    throw new Error(`Failed to load template: ${templateError.message}`)
  }
  if (!template) {
    throw new Error('Template not found')
  }

  const { count: sendCount, error: sendError } = await db
    .from('outreach_sends')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', templateId)

  if (sendError) {
    throw new Error(`Failed to check outreach sends: ${sendError.message}`)
  }
  if ((sendCount ?? 0) > 0) {
    throw new Error('Cannot delete a template that has already been used in outreach sends')
  }

  const { data: rules, error: rulesError } = await db
    .from('outreach_rules')
    .select('contact_kind')
    .eq('template_id', templateId)
    .eq('action', 'send_email')

  if (rulesError) {
    throw new Error(`Failed to check outreach rules: ${rulesError.message}`)
  }
  if ((rules ?? []).length > 0) {
    const kinds = (rules ?? []).map((r) => r.contact_kind).join(', ')
    throw new Error(
      `Cannot delete this template while outreach rules still reference it (${kinds}). Update rules first.`
    )
  }

  const { error: deleteError } = await db.from('email_templates').delete().eq('id', templateId)
  if (deleteError) {
    throw new Error(`Failed to delete email template: ${deleteError.message}`)
  }

  const remaining = await loadAllTemplates(db)
  if (remaining.length > 0 && !remaining.some((t) => t.isDefault)) {
    const nextDefault = remaining[0]
    const { error: defaultError } = await db
      .from('email_templates')
      .update({ is_default: true })
      .eq('id', nextDefault.id)

    if (defaultError) {
      throw new Error(`Failed to set default template: ${defaultError.message}`)
    }

    return loadAllTemplates(db)
  }

  return remaining
}

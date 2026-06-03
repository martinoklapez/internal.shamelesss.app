import type {
  ActivityEvent,
  CreatorContact,
  CreatorOutreachStore,
  CreatorPerson,
  EmailTemplate,
  EmailTouchpoint,
  OutreachRule,
  OutreachSend,
  SendFromAddress,
  SocialMediaProfile,
} from '@/lib/creator-outreach/types'
import type {
  ActivityEventRow,
  AssociationRow,
  ContactRow,
  CreatorRow,
  EmailTemplateRow,
  EmailTouchpointRow,
  OutreachRuleRow,
  OutreachSendRow,
  ProfileRow,
  SendFromAddressRow,
} from './rows'

export function mapCreatorRow(row: CreatorRow): CreatorPerson {
  return {
    id: row.id,
    displayName: row.display_name,
    notes: row.notes,
    avatarProfileId: row.avatar_profile_id ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapProfileRow(row: ProfileRow, creatorId: string | null): SocialMediaProfile {
  return {
    id: row.id,
    platform: row.platform,
    handle: row.handle,
    displayName: row.display_name?.trim() ?? '',
    profileUrl: row.profile_url,
    avatarUrl: row.avatar_url ?? null,
    followerCount: row.follower_count,
    creatorId,
    notes: row.notes,
    scoutedAt: row.scouted_at,
    scoutedBy: row.scouted_by,
  }
}

export function mapContactRow(row: ContactRow, creatorId: string | null): CreatorContact {
  return {
    id: row.id,
    creatorId,
    kind: row.kind,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone ?? '',
    notes: row.notes,
    status: row.status,
    missiveConversationIds: Array.isArray(row.missive_conversation_ids)
      ? row.missive_conversation_ids
      : [],
    createdAt: row.created_at,
  }
}

export function mapTemplateRow(row: EmailTemplateRow): EmailTemplate {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    bodyPreview: row.body_preview,
    isDefault: row.is_default,
  }
}

export function templateToRow(template: EmailTemplate): EmailTemplateRow {
  return {
    id: template.id,
    name: template.name,
    subject: template.subject,
    body_preview: template.bodyPreview,
    is_default: template.isDefault,
    created_at: new Date().toISOString(),
  }
}

export function mapTouchpointRow(row: EmailTouchpointRow): EmailTouchpoint {
  return {
    id: row.id,
    email: row.email,
    profileId: row.profile_id,
    contactId: row.contact_id,
    creatorId: row.creator_id,
    addedAt: row.added_at,
  }
}

export function mapSendFromAddressRow(row: SendFromAddressRow): SendFromAddress {
  const accountId = row.missive_account_id?.trim()
  return {
    id: row.id,
    address: row.address,
    displayName: row.display_name,
    missiveAccountId: accountId || undefined,
    signatureHtml: row.signature_html?.trim() || undefined,
    enabled: row.enabled,
    isDefault: row.is_default,
  }
}

export function sendFromAddressToRow(address: SendFromAddress): SendFromAddressRow {
  const accountId = address.missiveAccountId?.trim()
  return {
    id: address.id,
    address: address.address,
    display_name: address.displayName,
    missive_account_id: accountId || null,
    signature_html: address.signatureHtml?.trim() || null,
    enabled: address.enabled,
    is_default: address.isDefault,
    created_at: new Date().toISOString(),
  }
}

export function mapOutreachSendRow(
  row: OutreachSendRow,
  fallbackFrom?: { address: string; displayName: string }
): OutreachSend {
  return {
    id: row.id,
    email: row.email,
    templateId: row.template_id,
    templateName: row.template_name,
    fromAddress: row.from_address ?? fallbackFrom?.address ?? '',
    fromDisplayName: row.from_display_name ?? fallbackFrom?.displayName ?? '',
    profileId: row.profile_id,
    contactId: row.contact_id,
    creatorId: row.creator_id,
    status: row.status,
    sentAt: row.sent_at,
  }
}

export function mapOutreachRuleRow(row: OutreachRuleRow): OutreachRule {
  return {
    id: row.id,
    enabled: row.enabled,
    trigger: row.trigger,
    contactKind: row.contact_kind,
    action: row.action,
    templateId: row.template_id,
    sendFromId: row.send_from_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function outreachRuleToRow(rule: OutreachRule): OutreachRuleRow {
  return {
    id: rule.id,
    enabled: rule.enabled,
    trigger: rule.trigger,
    contact_kind: rule.contactKind,
    action: rule.action,
    template_id: rule.action === 'send_email' ? rule.templateId : null,
    send_from_id: rule.action === 'send_email' ? rule.sendFromId : null,
    created_at: rule.createdAt,
    updated_at: rule.updatedAt,
  }
}

export function mapActivityRow(row: ActivityEventRow): ActivityEvent {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    createdAt: row.created_at,
  }
}

export function creatorToRow(c: CreatorPerson): CreatorRow {
  return {
    id: c.id,
    display_name: c.displayName,
    notes: c.notes,
    avatar_profile_id: c.avatarProfileId,
    status: c.status,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  }
}

export function profileToRow(p: SocialMediaProfile): ProfileRow {
  return {
    id: p.id,
    platform: p.platform,
    handle: p.handle,
    display_name: p.displayName,
    profile_url: p.profileUrl,
    avatar_url: p.avatarUrl,
    follower_count: p.followerCount,
    notes: p.notes,
    scouted_at: p.scoutedAt,
    scouted_by: p.scoutedBy,
  }
}

export function contactToRow(c: CreatorContact): ContactRow {
  return {
    id: c.id,
    kind: c.kind,
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    notes: c.notes,
    status: c.status,
    missive_conversation_ids: c.missiveConversationIds,
    created_at: c.createdAt,
  }
}

export function buildAssociationRows(store: CreatorOutreachStore): Omit<AssociationRow, 'id' | 'created_at'>[] {
  const rows: Omit<AssociationRow, 'id' | 'created_at'>[] = []
  for (const profile of store.profiles) {
    if (profile.creatorId) {
      rows.push({
        creator_id: profile.creatorId,
        profile_id: profile.id,
        contact_id: null,
      })
    }
  }
  for (const contact of store.contacts) {
    if (!contact.creatorId) continue
    rows.push({
      creator_id: contact.creatorId,
      profile_id: null,
      contact_id: contact.id,
    })
  }
  return rows
}

export function applyAssociations(
  profiles: ProfileRow[],
  contacts: ContactRow[],
  associations: AssociationRow[]
): { profiles: SocialMediaProfile[]; contacts: CreatorContact[] } {
  const profileCreator = new Map<string, string>()
  const contactCreator = new Map<string, string>()
  for (const a of associations) {
    if (a.profile_id) profileCreator.set(a.profile_id, a.creator_id)
    if (a.contact_id) contactCreator.set(a.contact_id, a.creator_id)
  }
  return {
    profiles: profiles.map((p) => mapProfileRow(p, profileCreator.get(p.id) ?? null)),
    contacts: contacts.map((c) =>
      mapContactRow(c, contactCreator.get(c.id) ?? null)
    ),
  }
}

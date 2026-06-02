export const OUTREACH_TEMPLATE_PLACEHOLDERS = [
  { key: 'creator_name', label: 'Creator name', example: 'Alex Rivera' },
  { key: 'contact_name', label: 'Contact name', example: 'Alex' },
  { key: 'platform', label: 'Platform', example: 'Instagram' },
  { key: 'handle', label: 'Handle', example: 'alexcreates' },
] as const

export type OutreachTemplatePlaceholderKey =
  (typeof OUTREACH_TEMPLATE_PLACEHOLDERS)[number]['key']

export const OUTREACH_TEMPLATE_PREVIEW_VARS: Record<OutreachTemplatePlaceholderKey, string> =
  Object.fromEntries(
    OUTREACH_TEMPLATE_PLACEHOLDERS.map((p) => [p.key, p.example])
  ) as Record<OutreachTemplatePlaceholderKey, string>

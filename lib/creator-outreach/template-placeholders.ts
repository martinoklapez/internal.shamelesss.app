export const OUTREACH_TEMPLATE_PLACEHOLDERS = [
  { key: 'creator_name', label: 'Creator name', example: 'Alex Rivera', kind: 'text' as const },
  { key: 'contact_name', label: 'Contact name', example: 'Alex', kind: 'text' as const },
  { key: 'platform', label: 'Platform', example: 'Instagram', kind: 'text' as const },
  { key: 'handle', label: 'Handle', example: 'alexcreates', kind: 'text' as const },
  {
    key: 'book_meeting',
    label: 'Book meeting',
    example: 'Cal.com button',
    kind: 'widget' as const,
  },
] as const

export type OutreachTemplatePlaceholderKey =
  (typeof OUTREACH_TEMPLATE_PLACEHOLDERS)[number]['key']

export const OUTREACH_TEMPLATE_PREVIEW_VARS: Record<OutreachTemplatePlaceholderKey, string> =
  Object.fromEntries(
    OUTREACH_TEMPLATE_PLACEHOLDERS.map((p) => [p.key, p.example])
  ) as Record<OutreachTemplatePlaceholderKey, string>

export type SocialAccountSelectableStatus =
  | 'planned'
  | 'warmup'
  | 'active'
  | 'paused'
  | 'banned'

export const SOCIAL_ACCOUNT_STATUS_OPTIONS: SocialAccountSelectableStatus[] = [
  'planned',
  'warmup',
  'active',
  'paused',
  'banned',
]

export const SOCIAL_STATUS_CHIP_STYLES: Record<
  SocialAccountSelectableStatus,
  { bg: string; text: string }
> = {
  planned: { bg: '#F1F1EF', text: '#787774' },
  warmup: { bg: '#FAF3DD', text: '#C29343' },
  active: { bg: '#EEF3ED', text: '#548164' },
  paused: { bg: '#F8ECDF', text: '#CC782F' },
  banned: { bg: '#FEE2E2', text: '#991B1B' },
}

export const SOCIAL_STATUS_NONE_STYLE = { bg: '#F1F1EF', text: '#787774' }

export function getSocialStatusChipStyle(status: string | null | undefined) {
  if (status && status in SOCIAL_STATUS_CHIP_STYLES) {
    return SOCIAL_STATUS_CHIP_STYLES[status as SocialAccountSelectableStatus]
  }
  return SOCIAL_STATUS_NONE_STYLE
}

export function formatSocialStatusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

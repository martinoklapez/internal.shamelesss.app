/** Flags no longer read by current app builds (behavior hardcoded). Kept in DB for audit / old clients. */
export const REMOVED_FEATURE_FLAG_IDS = [
  'force_paywall',
  'chats',
  'friends',
  'reengagement',
  'explore_filter_paywall_on_gender_tap',
  'explore_filter_paywall_on_region_tap',
  'force_paywall_filters_tap',
  'force_paywall_filters',
  'force_paywall_profile_views',
  'force_paywall_social_handle_reveal',
  'force_paywall_profile_fullscreen',
  'force_paywall_explore_friend_send',
  'force_paywall_explore_friend_actions',
  'force_paywall_explore_load_more',
  'force_paywall_onboarding',
  'force_paywall_game_start',
] as const

export type RemovedFeatureFlagId = (typeof REMOVED_FEATURE_FLAG_IDS)[number]

export const REMOVED_FEATURE_FLAG_ID_SET = new Set<string>(REMOVED_FEATURE_FLAG_IDS)

export const REMOVED_FEATURE_FLAG_DESCRIPTION =
  'Removed from the client app. Behavior is hardcoded; this row is kept for older builds and audit only.'

export function isRemovedFeatureFlag(flagId: string): boolean {
  return REMOVED_FEATURE_FLAG_ID_SET.has(flagId)
}

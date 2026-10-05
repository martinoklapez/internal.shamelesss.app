-- Mark paywall feature flags that are no longer read by the client (hardcoded behavior).
-- Safe to re-run: only updates matching flag_id rows.

UPDATE public.feature_flags
SET
  is_enabled = false,
  description = 'Removed from the client app. Behavior is hardcoded; this row is kept for older builds and audit only.',
  updated_at = now()
WHERE flag_id IN (
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
  'force_paywall_game_start'
);

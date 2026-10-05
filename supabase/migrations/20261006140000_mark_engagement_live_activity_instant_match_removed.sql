-- Mark engagement_live_activity and instant_match as removed (hardcoded in client).
-- Safe to re-run: only updates matching flag_id rows.

UPDATE public.feature_flags
SET
  is_enabled = false,
  description = 'Removed from the client app. Behavior is hardcoded; this row is kept for older builds and audit only.',
  updated_at = now()
WHERE flag_id IN (
  'engagement_live_activity',
  'instant_match'
);

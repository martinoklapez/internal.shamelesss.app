-- =============================================================================
-- Demo re-engagement chain: campaigns → demo users → friend_requests
-- Run in Supabase SQL Editor to verify the test campaign and any executions.
-- Campaigns are stored in demo_reengagement_campaigns (one row per campaign).
-- =============================================================================

-- 1) Campaign count and last update
SELECT
  count(*) AS campaign_count,
  max(updated_at) AS last_updated_at
FROM demo_reengagement_campaigns;

-- 2) Each campaign (id, name, trigger, time_config, enabled)
SELECT
  id AS campaign_id,
  name,
  trigger,
  enabled,
  time_config AS time_config_utc,
  target_selection->'flow_slots' AS flow_slots,
  created_at,
  updated_at
FROM demo_reengagement_campaigns
ORDER BY created_at ASC;

-- 3) Demo users (used as from_user_id when creating demo friend requests)
SELECT
  ur.user_id AS demo_user_id,
  p.name,
  p.username,
  p.gender
FROM user_roles ur
LEFT JOIN profiles p ON p.user_id = ur.user_id
WHERE ur.role = 'demo'
ORDER BY ur.user_id;

-- 4) Recent friend requests FROM demo users (the “chain” output when flow runs)
-- Replace the interval if you want a longer window (e.g. '7 days')
SELECT
  fr.id,
  fr.from_user_id AS demo_user_id,
  fr.to_user_id AS target_user_id,
  fr.status,
  fr.message,
  fr.source,
  fr.created_at,
  fp_from.name AS from_name,
  fp_to.name AS to_name
FROM friend_requests fr
JOIN user_roles ur ON ur.user_id = fr.from_user_id AND ur.role = 'demo'
LEFT JOIN profiles fp_from ON fp_from.user_id = fr.from_user_id
LEFT JOIN profiles fp_to   ON fp_to.user_id = fr.to_user_id
WHERE fr.created_at > now() - interval '7 days'
ORDER BY fr.created_at DESC;

-- 5) Optional: run_once_per_user tracking (if this table exists in your DB)
-- Uncomment and run only if you have demo_reengagement_completed:
/*
SELECT *
FROM demo_reengagement_completed
WHERE completed_at > now() - interval '7 days'
ORDER BY completed_at DESC;
*/

-- Re-seed creator_pipeline.outreach_rules if rows were deleted.
-- Safe to run in Supabase SQL editor (idempotent via ON CONFLICT).

WITH default_template AS (
  SELECT id FROM creator_pipeline.email_templates
  ORDER BY is_default DESC, name ASC
  LIMIT 1
),
default_sender AS (
  SELECT id FROM creator_pipeline.send_from_addresses
  WHERE enabled = true
  ORDER BY is_default DESC, address ASC
  LIMIT 1
)
INSERT INTO creator_pipeline.outreach_rules (
  contact_kind,
  action,
  template_id,
  send_from_id,
  enabled,
  trigger
)
SELECT
  kind,
  CASE
    WHEN kind = 'other' THEN 'do_not_send'::creator_pipeline.outreach_rule_action
    ELSE 'send_email'::creator_pipeline.outreach_rule_action
  END,
  CASE WHEN kind = 'other' THEN NULL ELSE (SELECT id FROM default_template) END,
  CASE WHEN kind = 'other' THEN NULL ELSE (SELECT id FROM default_sender) END,
  true,
  'contact_email_ready'::creator_pipeline.outreach_rule_trigger
FROM unnest(
  ARRAY[
    'creator'::creator_pipeline.contact_kind,
    'manager'::creator_pipeline.contact_kind,
    'agency'::creator_pipeline.contact_kind,
    'other'::creator_pipeline.contact_kind
  ]
) AS kind
ON CONFLICT (contact_kind) DO UPDATE SET
  action = EXCLUDED.action,
  template_id = EXCLUDED.template_id,
  send_from_id = EXCLUDED.send_from_id,
  enabled = EXCLUDED.enabled,
  trigger = EXCLUDED.trigger,
  updated_at = timezone('utc'::text, now());

SELECT contact_kind, action, template_id, send_from_id, enabled
FROM creator_pipeline.outreach_rules
ORDER BY contact_kind;

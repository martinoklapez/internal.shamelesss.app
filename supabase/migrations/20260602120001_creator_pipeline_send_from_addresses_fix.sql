-- Repair script if 20260602120000 failed on outreach_rules_action_template_check.
-- Safe to run after a partial apply (re-run whole block in SQL editor).

INSERT INTO creator_pipeline.send_from_addresses (id, address, display_name, is_default, enabled)
VALUES (
  'b0000000-0000-4000-8000-000000000001',
  'valerius@creators.shamelesss.app',
  'Shamelesss',
  true,
  true
)
ON CONFLICT (address) DO NOTHING;

ALTER TABLE creator_pipeline.outreach_rules
  ADD COLUMN IF NOT EXISTS send_from_id uuid NULL
  REFERENCES creator_pipeline.send_from_addresses (id) ON DELETE SET NULL;

UPDATE creator_pipeline.outreach_rules
SET template_id = (
  SELECT id FROM creator_pipeline.email_templates
  ORDER BY is_default DESC, name ASC
  LIMIT 1
)
WHERE action = 'send_email' AND template_id IS NULL;

UPDATE creator_pipeline.outreach_rules
SET send_from_id = 'b0000000-0000-4000-8000-000000000001'::uuid
WHERE action = 'send_email' AND send_from_id IS NULL;

UPDATE creator_pipeline.outreach_rules
SET send_from_id = NULL
WHERE action = 'do_not_send';

ALTER TABLE creator_pipeline.outreach_rules
  DROP CONSTRAINT IF EXISTS outreach_rules_action_template_check;

ALTER TABLE creator_pipeline.outreach_rules
  ADD CONSTRAINT outreach_rules_action_template_check CHECK (
    (action = 'send_email' AND template_id IS NOT NULL AND send_from_id IS NOT NULL)
    OR (action = 'do_not_send' AND template_id IS NULL AND send_from_id IS NULL)
  );

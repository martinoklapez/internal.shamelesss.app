-- Send-from addresses for outreach (Missive/Gmail aliases), selectable per outreach rule.

CREATE TABLE IF NOT EXISTS creator_pipeline.send_from_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT send_from_addresses_address_unique UNIQUE (address)
);

CREATE INDEX IF NOT EXISTS send_from_addresses_enabled_idx
  ON creator_pipeline.send_from_addresses (enabled, is_default);

-- Default sender (update address in Pipeline → Senders after deploy)
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

ALTER TABLE creator_pipeline.outreach_sends
  ADD COLUMN IF NOT EXISTS from_address text NULL,
  ADD COLUMN IF NOT EXISTS from_display_name text NULL;

-- Backfill missing FKs before tightening the check constraint.
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

-- Clear sender on do_not_send rows if any legacy data set it.
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

ALTER TABLE creator_pipeline.send_from_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_pipeline_authenticated_all_send_from_addresses"
  ON creator_pipeline.send_from_addresses FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE creator_pipeline.send_from_addresses IS
  'Missive/Gmail From addresses allowed for automated outreach. Must exist as send-as alias in Gmail and Missive.';

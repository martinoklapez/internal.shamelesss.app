-- Per contact-type rules when a contact gets a new email (create or update)

DO $$ BEGIN
  CREATE TYPE creator_pipeline.outreach_rule_trigger AS ENUM ('contact_email_ready');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE creator_pipeline.outreach_rule_action AS ENUM ('send_email', 'do_not_send');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE creator_pipeline.activity_event_type ADD VALUE IF NOT EXISTS 'outreach_queued';

CREATE TABLE IF NOT EXISTS creator_pipeline.outreach_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  trigger creator_pipeline.outreach_rule_trigger NOT NULL DEFAULT 'contact_email_ready',
  contact_kind creator_pipeline.contact_kind NOT NULL,
  action creator_pipeline.outreach_rule_action NOT NULL,
  template_id uuid NULL REFERENCES creator_pipeline.email_templates (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT outreach_rules_contact_kind_unique UNIQUE (contact_kind),
  CONSTRAINT outreach_rules_action_template_check CHECK (
    (action = 'send_email' AND template_id IS NOT NULL)
    OR (action = 'do_not_send' AND template_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS outreach_rules_enabled_kind_idx
  ON creator_pipeline.outreach_rules (enabled, contact_kind);

-- One row per contact kind (ids generated; contact_kind is the stable key)
INSERT INTO creator_pipeline.outreach_rules (contact_kind, action, template_id, enabled)
SELECT
  kind,
  CASE WHEN kind = 'other' THEN 'do_not_send'::creator_pipeline.outreach_rule_action
       ELSE 'send_email'::creator_pipeline.outreach_rule_action
  END,
  CASE WHEN kind = 'other' THEN NULL
       ELSE 'a0000000-0000-4000-8000-000000000001'::uuid
  END,
  true
FROM unnest(
  ARRAY[
    'creator'::creator_pipeline.contact_kind,
    'manager'::creator_pipeline.contact_kind,
    'agency'::creator_pipeline.contact_kind,
    'other'::creator_pipeline.contact_kind
  ]
) AS kind
ON CONFLICT (contact_kind) DO NOTHING;

ALTER TABLE creator_pipeline.outreach_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_pipeline_authenticated_all_outreach_rules"
  ON creator_pipeline.outreach_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE creator_pipeline.outreach_rules IS
  'contact_email_ready: new email on contact (created with email or email added/changed). Maps contact_kind → send template or do_not_send.';

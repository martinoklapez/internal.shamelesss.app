-- Revert 20260528140000_creator_pipeline_automation_rules.sql (prod / any env)

-- Point outreach rows at the original default template before deleting new templates
UPDATE creator_pipeline.outreach_sends
SET
  template_id = 'a0000000-0000-4000-8000-000000000001',
  template_name = COALESCE(
    (SELECT name FROM creator_pipeline.email_templates WHERE id = 'a0000000-0000-4000-8000-000000000001'),
    'Initial outreach'
  )
WHERE template_id IN (
  'a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000004'
);

DELETE FROM creator_pipeline.automation_rules
WHERE id IN (
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002'
);

DROP POLICY IF EXISTS "creator_pipeline_authenticated_all_automation_rules"
  ON creator_pipeline.automation_rules;

DROP TABLE IF EXISTS creator_pipeline.automation_rules;

DROP TYPE IF EXISTS creator_pipeline.automation_trigger;

DELETE FROM creator_pipeline.email_templates
WHERE id IN (
  'a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000004'
);

UPDATE creator_pipeline.email_templates
SET
  name = 'Initial outreach',
  is_default = true
WHERE id = 'a0000000-0000-4000-8000-000000000001';

-- Note: activity_event_type value 'outreach_queued' cannot be removed in PostgreSQL; harmless if left.

-- CRM statuses: New, Contacted, Reached, Blocked (replaces qualified / passed)

CREATE TYPE creator_pipeline.contact_crm_status_v2 AS ENUM ('new', 'contacted', 'reached', 'blocked');

ALTER TABLE creator_pipeline.creators
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE creator_pipeline.contact_crm_status_v2
  USING (
    CASE status::text
      WHEN 'qualified' THEN 'contacted'::creator_pipeline.contact_crm_status_v2
      WHEN 'passed' THEN 'blocked'::creator_pipeline.contact_crm_status_v2
      ELSE status::text::creator_pipeline.contact_crm_status_v2
    END
  ),
  ALTER COLUMN status SET DEFAULT 'new';

ALTER TABLE creator_pipeline.contacts
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE creator_pipeline.contact_crm_status_v2
  USING (
    CASE status::text
      WHEN 'qualified' THEN 'contacted'::creator_pipeline.contact_crm_status_v2
      WHEN 'passed' THEN 'blocked'::creator_pipeline.contact_crm_status_v2
      ELSE status::text::creator_pipeline.contact_crm_status_v2
    END
  ),
  ALTER COLUMN status SET DEFAULT 'new';

DROP TYPE creator_pipeline.contact_crm_status;

ALTER TYPE creator_pipeline.contact_crm_status_v2 RENAME TO contact_crm_status;

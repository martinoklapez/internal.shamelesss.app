-- Server-side outreach trigger: contact email ready → pending event → worker (API / cron)

DO $$ BEGIN
  CREATE TYPE creator_pipeline.outreach_event_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS creator_pipeline.outreach_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES creator_pipeline.contacts (id) ON DELETE CASCADE,
  trigger creator_pipeline.outreach_rule_trigger NOT NULL DEFAULT 'contact_email_ready',
  email_snapshot text NOT NULL,
  status creator_pipeline.outreach_event_status NOT NULL DEFAULT 'pending',
  result jsonb NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  processed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS outreach_events_pending_created_idx
  ON creator_pipeline.outreach_events (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS outreach_events_contact_id_idx
  ON creator_pipeline.outreach_events (contact_id);

CREATE OR REPLACE FUNCTION creator_pipeline.normalize_contact_email(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(COALESCE(raw, '')));
$$;

CREATE OR REPLACE FUNCTION creator_pipeline.enqueue_contact_email_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = creator_pipeline
AS $$
DECLARE
  new_email text;
  old_email text;
BEGIN
  new_email := creator_pipeline.normalize_contact_email(NEW.email);

  IF new_email = '' OR position('@' IN new_email) = 0 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_email := creator_pipeline.normalize_contact_email(OLD.email);
    IF old_email = new_email THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO creator_pipeline.outreach_events (contact_id, email_snapshot)
  VALUES (NEW.id, new_email);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_enqueue_email_ready ON creator_pipeline.contacts;

CREATE TRIGGER contacts_enqueue_email_ready
  AFTER INSERT OR UPDATE OF email ON creator_pipeline.contacts
  FOR EACH ROW
  EXECUTE FUNCTION creator_pipeline.enqueue_contact_email_ready();

ALTER TABLE creator_pipeline.outreach_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_pipeline_authenticated_all_outreach_events"
  ON creator_pipeline.outreach_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE creator_pipeline.outreach_events IS
  'Queued by DB trigger on contacts.email; processed by POST /api/creator-pipeline/process-outreach (rules + Missive).';

-- Server-side Quick Add queue: scrape profiles in background, human confirms when ready.

DO $$ BEGIN
  CREATE TYPE creator_pipeline.quick_add_job_status AS ENUM (
    'pending',
    'scraping',
    'ready',
    'confirming',
    'completed',
    'failed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS creator_pipeline.quick_add_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  url text NOT NULL,
  url_normalized text NOT NULL,
  status creator_pipeline.quick_add_job_status NOT NULL DEFAULT 'pending',
  resolved_payload jsonb,
  plan_payload jsonb,
  notes text NOT NULL DEFAULT '',
  error_message text,
  result_profile_id uuid NULL REFERENCES creator_pipeline.profiles (id) ON DELETE SET NULL,
  result_creator_id uuid NULL REFERENCES creator_pipeline.creators (id) ON DELETE SET NULL,
  result_contact_id uuid NULL REFERENCES creator_pipeline.contacts (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  scraped_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS quick_add_jobs_pending_created_idx
  ON creator_pipeline.quick_add_jobs (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS quick_add_jobs_active_created_idx
  ON creator_pipeline.quick_add_jobs (created_at)
  WHERE status IN ('pending', 'scraping', 'ready', 'confirming');

CREATE UNIQUE INDEX IF NOT EXISTS quick_add_jobs_active_url_normalized_unique
  ON creator_pipeline.quick_add_jobs (url_normalized)
  WHERE status IN ('pending', 'scraping', 'ready', 'confirming');

ALTER TABLE creator_pipeline.quick_add_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_pipeline_authenticated_all_quick_add_jobs"
  ON creator_pipeline.quick_add_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE creator_pipeline.quick_add_jobs IS
  'Quick Add queue: Apify scrape runs in worker; ready rows await human confirm in CRM UI.';

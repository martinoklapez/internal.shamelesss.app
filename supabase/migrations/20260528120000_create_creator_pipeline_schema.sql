-- Creator CRM / outreach pipeline (isolated schema, no public views)
CREATE SCHEMA IF NOT EXISTS creator_pipeline;

-- Enums
DO $$ BEGIN
  CREATE TYPE creator_pipeline.outreach_platform AS ENUM ('tiktok', 'instagram');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE creator_pipeline.contact_crm_status AS ENUM ('new', 'contacted', 'reached', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE creator_pipeline.contact_kind AS ENUM ('creator', 'manager', 'agency', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE creator_pipeline.outreach_send_status AS ENUM ('queued', 'sent', 'skipped_duplicate');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE creator_pipeline.activity_event_type AS ENUM (
    'profile_scouted',
    'creator_created',
    'profile_linked',
    'profile_unlinked',
    'contact_added',
    'contact_removed',
    'email_added',
    'outreach_sent',
    'outreach_skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Core entities
CREATE TABLE IF NOT EXISTS creator_pipeline.creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  notes text NOT NULL DEFAULT '',
  status creator_pipeline.contact_crm_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS creator_pipeline.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform creator_pipeline.outreach_platform NOT NULL,
  handle text NOT NULL,
  profile_url text NOT NULL,
  follower_count bigint NULL,
  notes text NOT NULL DEFAULT '',
  scouted_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  scouted_by text NOT NULL DEFAULT 'Team'
);

CREATE TABLE IF NOT EXISTS creator_pipeline.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind creator_pipeline.contact_kind NOT NULL DEFAULT 'other',
  name text NOT NULL,
  company text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status creator_pipeline.contact_crm_status NOT NULL DEFAULT 'new',
  missive_conversation_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3-way hub: from any row, resolve creator + optional profile + optional contact
CREATE TABLE IF NOT EXISTS creator_pipeline.associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creator_pipeline.creators (id) ON DELETE CASCADE,
  profile_id uuid NULL REFERENCES creator_pipeline.profiles (id) ON DELETE CASCADE,
  contact_id uuid NULL REFERENCES creator_pipeline.contacts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT associations_has_target CHECK (profile_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS associations_profile_unique
  ON creator_pipeline.associations (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS associations_contact_unique
  ON creator_pipeline.associations (contact_id)
  WHERE contact_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS associations_creator_profile_unique
  ON creator_pipeline.associations (creator_id, profile_id)
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS associations_creator_contact_unique
  ON creator_pipeline.associations (creator_id, contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS associations_creator_id_idx
  ON creator_pipeline.associations (creator_id);

-- Templates, log, outreach
CREATE TABLE IF NOT EXISTS creator_pipeline.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body_preview text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS creator_pipeline.email_touchpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  profile_id uuid NULL REFERENCES creator_pipeline.profiles (id) ON DELETE SET NULL,
  contact_id uuid NULL REFERENCES creator_pipeline.contacts (id) ON DELETE SET NULL,
  creator_id uuid NULL REFERENCES creator_pipeline.creators (id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS creator_pipeline.outreach_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  template_id uuid NOT NULL REFERENCES creator_pipeline.email_templates (id) ON DELETE RESTRICT,
  template_name text NOT NULL,
  profile_id uuid NULL REFERENCES creator_pipeline.profiles (id) ON DELETE SET NULL,
  contact_id uuid NULL REFERENCES creator_pipeline.contacts (id) ON DELETE SET NULL,
  creator_id uuid NULL REFERENCES creator_pipeline.creators (id) ON DELETE SET NULL,
  status creator_pipeline.outreach_send_status NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS creator_pipeline.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type creator_pipeline.activity_event_type NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Default outreach templates
INSERT INTO creator_pipeline.email_templates (id, name, subject, body_preview, is_default)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'Initial outreach',
    'Collaboration idea for {{creator_name}}',
    'Hi {{creator_name}}, we love your content on {{platform}} (@{{handle}}). We built Shamelesss and think your audience would resonate…',
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'Follow-up',
    'Quick follow-up — Shamelesss x {{creator_name}}',
    'Hi {{creator_name}}, just bumping my note from last week in case it got buried…',
    false
  )
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE creator_pipeline.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_pipeline.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_pipeline.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_pipeline.associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_pipeline.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_pipeline.email_touchpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_pipeline.outreach_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_pipeline.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_pipeline_authenticated_all_creators"
  ON creator_pipeline.creators FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "creator_pipeline_authenticated_all_profiles"
  ON creator_pipeline.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "creator_pipeline_authenticated_all_contacts"
  ON creator_pipeline.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "creator_pipeline_authenticated_all_associations"
  ON creator_pipeline.associations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "creator_pipeline_authenticated_all_email_templates"
  ON creator_pipeline.email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "creator_pipeline_authenticated_all_email_touchpoints"
  ON creator_pipeline.email_touchpoints FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "creator_pipeline_authenticated_all_outreach_sends"
  ON creator_pipeline.outreach_sends FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "creator_pipeline_authenticated_all_activity_events"
  ON creator_pipeline.activity_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- API / client access (PostgREST exposed schema — also add creator_pipeline in Dashboard → API → Exposed schemas)
GRANT USAGE ON SCHEMA creator_pipeline TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA creator_pipeline TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA creator_pipeline TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA creator_pipeline
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

COMMENT ON SCHEMA creator_pipeline IS 'Creator CRM pipeline: creators, profiles, contacts, associations, templates, log.';
COMMENT ON TABLE creator_pipeline.associations IS '3-way link hub: creator_id + optional profile_id and/or contact_id.';

-- Demo re-engagement config: controls demo-reengagement edge function (e.g. fake friend requests for non-subscribers when app goes to background)
CREATE TABLE IF NOT EXISTS public.demo_reengagement_config (
  id text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT demo_reengagement_config_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Single row for app config
INSERT INTO public.demo_reengagement_config (id, config)
VALUES (
  'default',
  '{"rate_limit_hours":24,"max_requests_per_user_per_day":1,"include_message":false,"message_template":null,"min_days_since_signup":0,"exclude_promoter":true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.demo_reengagement_config ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (app enforces role on write via API)
CREATE POLICY "Allow authenticated read" ON public.demo_reengagement_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Update: only via service role or app API (app checks admin/developer before calling Supabase)
-- Allow authenticated so the API (using createClient()) can UPDATE; app route restricts to admin/developer
CREATE POLICY "Allow authenticated update" ON public.demo_reengagement_config
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.demo_reengagement_config IS 'Config for demo-reengagement edge function (e.g. fake friend requests when app goes to background).';

-- Campaigns: one row per campaign (replaces config.campaigns in demo_reengagement_config)
CREATE TABLE IF NOT EXISTS public.demo_reengagement_campaigns (
  id text NOT NULL,
  name text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  trigger text NOT NULL DEFAULT 'app_close',
  time_config jsonb,
  skip_if_subscribed boolean NOT NULL DEFAULT true,
  run_once_per_user boolean NOT NULL DEFAULT true,
  delay_seconds integer NOT NULL DEFAULT 0,
  delay_between_slots_seconds integer NOT NULL DEFAULT 0,
  target_selection jsonb NOT NULL DEFAULT '{"mode":"direct","flow_slots":[]}'::jsonb,
  rate_limit_hours integer NOT NULL DEFAULT 24,
  max_requests_per_user_per_day integer NOT NULL DEFAULT 1,
  requests_per_trigger integer NOT NULL DEFAULT 1,
  min_days_since_signup integer NOT NULL DEFAULT 0,
  exclude_promoter boolean NOT NULL DEFAULT true,
  include_message boolean NOT NULL DEFAULT false,
  message_template text,
  created_at timestamptz NOT NULL DEFAULT (timezone('utc'::text, now())),
  updated_at timestamptz NOT NULL DEFAULT (timezone('utc'::text, now())),
  CONSTRAINT demo_reengagement_campaigns_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

ALTER TABLE public.demo_reengagement_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read campaigns"
  ON public.demo_reengagement_campaigns FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert campaigns"
  ON public.demo_reengagement_campaigns FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update campaigns"
  ON public.demo_reengagement_campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated delete campaigns"
  ON public.demo_reengagement_campaigns FOR DELETE TO authenticated USING (true);

COMMENT ON TABLE public.demo_reengagement_campaigns IS 'One row per demo re-engagement campaign. Replaces demo_reengagement_config.config->campaigns.';

-- Migrate existing campaigns from demo_reengagement_config into demo_reengagement_campaigns
INSERT INTO public.demo_reengagement_campaigns (
  id,
  name,
  enabled,
  trigger,
  time_config,
  skip_if_subscribed,
  run_once_per_user,
  delay_seconds,
  delay_between_slots_seconds,
  target_selection,
  rate_limit_hours,
  max_requests_per_user_per_day,
  requests_per_trigger,
  min_days_since_signup,
  exclude_promoter,
  include_message,
  message_template,
  created_at,
  updated_at
)
SELECT
  COALESCE(c->>'id', 'campaign-' || (row_number() OVER ())::text),
  COALESCE(c->>'name', 'Unnamed'),
  COALESCE((c->>'enabled')::boolean, true),
  COALESCE(c->>'trigger', 'app_close'),
  c->'time_config',
  COALESCE((c->>'skip_if_subscribed')::boolean, true),
  COALESCE((c->>'run_once_per_user')::boolean, true),
  COALESCE(
    CASE WHEN (c->>'delay_seconds') IS NOT NULL THEN (c->>'delay_seconds')::integer
         WHEN (c->>'delay_minutes') IS NOT NULL THEN (c->>'delay_minutes')::integer * 60
         ELSE 0 END,
    0
  ),
  COALESCE((c->>'delay_between_slots_seconds')::integer, 0),
  COALESCE(c->'target_selection', '{"mode":"direct","flow_slots":[]}'::jsonb),
  COALESCE((c->>'rate_limit_hours')::integer, 24),
  COALESCE((c->>'max_requests_per_user_per_day')::integer, 1),
  COALESCE((c->>'requests_per_trigger')::integer, 1),
  COALESCE((c->>'min_days_since_signup')::integer, 0),
  COALESCE((c->>'exclude_promoter')::boolean, true),
  COALESCE((c->>'include_message')::boolean, false),
  CASE WHEN c->>'message_template' = '' THEN NULL ELSE c->>'message_template' END,
  COALESCE((cfg.updated_at)::timestamptz, timezone('utc'::text, now())),
  timezone('utc'::text, now())
FROM public.demo_reengagement_config cfg,
     jsonb_array_elements(
       CASE
         WHEN jsonb_typeof(cfg.config->'campaigns') = 'array' AND jsonb_array_length(cfg.config->'campaigns') > 0
         THEN cfg.config->'campaigns'
         ELSE '[]'::jsonb
       END
     ) AS c
WHERE cfg.id = 'default'
ON CONFLICT (id) DO NOTHING;

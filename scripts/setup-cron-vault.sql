-- One-time: Vault secrets for creator_pipeline.invoke_edge_function (pg_cron → Edge).
-- Run in Supabase SQL Editor. Replace YOUR_* before running create/update blocks.

-- 1) See what exists today
select id, name, description, created_at
from vault.secrets
where name in ('project_url', 'creator_outreach_cron_secret')
   or description ilike '%cron%'
   or description ilike '%project url%';

-- 2) Can cron role read secrets? (should return 2 rows with decrypted values)
select name, left(decrypted_secret, 12) as prefix
from vault.decrypted_secrets
where name in ('project_url', 'creator_outreach_cron_secret');

-- 3) Create secrets (skip if section 2 already shows both names)
-- Must match CREATOR_OUTREACH_CRON_SECRET on Vercel + Edge secrets.
select vault.create_secret(
  'https://esdzfopaahvbokddexeh.supabase.co',
  'project_url',
  'Supabase project URL'
);
select vault.create_secret(
  'YOUR_CREATOR_OUTREACH_CRON_SECRET',
  'creator_outreach_cron_secret',
  'Pipeline edge cron auth'
);

-- 4) If create fails (name already exists), update instead:
-- select vault.update_secret(
--   (select id from vault.secrets where name = 'project_url'),
--   'https://esdzfopaahvbokddexeh.supabase.co',
--   'project_url',
--   'Supabase project URL'
-- );
-- select vault.update_secret(
--   (select id from vault.secrets where name = 'creator_outreach_cron_secret'),
--   'YOUR_CREATOR_OUTREACH_CRON_SECRET',
--   'creator_outreach_cron_secret',
--   'Pipeline edge cron auth'
-- );

-- 5) Smoke test (should return a bigint, not error)
select creator_pipeline.invoke_edge_function('process-creator-outreach-sends');

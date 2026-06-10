-- Schedule Creator Pipeline Edge workers (Quick Add scrape + outreach sends) via pg_cron + pg_net.
-- Auth: Bearer CREATOR_OUTREACH_CRON_SECRET (same value as Edge secret / Vercel env).
--
-- Prereqs (Supabase Dashboard → Integrations): enable pg_cron and pg_net.
-- Do not CREATE EXTENSION here — hosted projects manage pg_cron in pg_catalog and
-- re-creating it from SQL conflicts with platform grants.
--
-- One-time Vault setup (SQL editor — replace values, run after this migration):
--   select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url', 'Supabase project URL');
--   select vault.create_secret('YOUR_CREATOR_OUTREACH_CRON_SECRET', 'creator_outreach_cron_secret', 'Pipeline edge cron auth');

create or replace function creator_pipeline.invoke_edge_function(function_slug text)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault, net, pg_temp
as $$
declare
  base_url text;
  auth_token text;
  request_id bigint;
begin
  select decrypted_secret into base_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into auth_token
  from vault.decrypted_secrets
  where name = 'creator_outreach_cron_secret'
  limit 1;

  if base_url is null or auth_token is null then
    raise warning 'creator_pipeline edge cron: configure vault secrets project_url and creator_outreach_cron_secret';
    return null;
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/' || function_slug,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || auth_token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) into request_id;

  return request_id;
end;
$$;

comment on function creator_pipeline.invoke_edge_function(text) is
  'POST to a Supabase Edge Function using vault secrets project_url + creator_outreach_cron_secret.';

revoke all on function creator_pipeline.invoke_edge_function(text) from public;
grant execute on function creator_pipeline.invoke_edge_function(text) to postgres;

do $cron$
begin
  perform cron.unschedule('creator-pipeline-quick-add');
exception
  when others then null;
end;
$cron$;

do $cron$
begin
  perform cron.unschedule('creator-pipeline-outreach-sends');
exception
  when others then null;
end;
$cron$;

select cron.schedule(
  'creator-pipeline-quick-add',
  '*/2 * * * *',
  $$select creator_pipeline.invoke_edge_function('process-creator-quick-add');$$
);

select cron.schedule(
  'creator-pipeline-outreach-sends',
  '*/2 * * * *',
  $$select creator_pipeline.invoke_edge_function('process-creator-outreach-sends');$$
);

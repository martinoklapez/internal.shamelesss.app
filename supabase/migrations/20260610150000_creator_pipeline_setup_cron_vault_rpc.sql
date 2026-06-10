-- RPC: upsert Vault secrets for pg_cron → Edge (callable with service role from local script).

create or replace function public.setup_creator_pipeline_cron_vault(
  project_url text,
  cron_secret text
)
returns text
language plpgsql
security definer
set search_path = vault, public, pg_temp
as $$
declare
  pid uuid;
  cid uuid;
  url text := trim(project_url);
  secret text := trim(cron_secret);
begin
  if url = '' or secret = '' then
    raise exception 'project_url and cron_secret are required';
  end if;

  select id into pid from vault.secrets where name = 'project_url' limit 1;
  if pid is null then
    select vault.create_secret(url, 'project_url', 'Supabase project URL') into pid;
  else
    perform vault.update_secret(pid, url, 'project_url', 'Supabase project URL');
  end if;

  select id into cid from vault.secrets where name = 'creator_outreach_cron_secret' limit 1;
  if cid is null then
    select vault.create_secret(secret, 'creator_outreach_cron_secret', 'Pipeline edge cron auth') into cid;
  else
    perform vault.update_secret(cid, secret, 'creator_outreach_cron_secret', 'Pipeline edge cron auth');
  end if;

  return 'vault secrets upserted';
end;
$$;

revoke all on function public.setup_creator_pipeline_cron_vault(text, text) from public;
grant execute on function public.setup_creator_pipeline_cron_vault(text, text) to service_role;

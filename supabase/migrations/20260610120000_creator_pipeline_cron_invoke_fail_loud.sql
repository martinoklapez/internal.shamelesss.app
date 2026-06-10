-- Cron: fail loudly when Vault secrets missing (instead of silent null + warning).

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

  if base_url is null and auth_token is null then
    raise exception
      'creator_pipeline edge cron: missing vault secrets project_url and creator_outreach_cron_secret (run scripts/setup-cron-vault.sql)';
  end if;
  if base_url is null then
    raise exception 'creator_pipeline edge cron: missing vault secret project_url';
  end if;
  if auth_token is null then
    raise exception 'creator_pipeline edge cron: missing vault secret creator_outreach_cron_secret';
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

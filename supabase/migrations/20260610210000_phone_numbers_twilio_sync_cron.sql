-- Optional pg_cron job: sync Twilio phone inventory into public.phone_numbers.
-- Requires pg_cron + pg_net and Vault secrets:
--   app_url                  — e.g. https://internal.shamelesss.app
--   creator_outreach_cron_secret — same as CREATOR_OUTREACH_CRON_SECRET
--
-- Manual sync: POST /api/phone-numbers/sync (logged-in admin/promoter or Bearer cron secret)

create or replace function public.invoke_phone_numbers_sync()
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
  where name = 'app_url'
  limit 1;

  select decrypted_secret into auth_token
  from vault.decrypted_secrets
  where name = 'creator_outreach_cron_secret'
  limit 1;

  if base_url is null or auth_token is null then
    raise warning 'phone sync cron: configure vault secrets app_url and creator_outreach_cron_secret';
    return null;
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/api/phone-numbers/sync',
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

comment on function public.invoke_phone_numbers_sync() is
  'POST to /api/phone-numbers/sync using vault app_url + creator_outreach_cron_secret.';

revoke all on function public.invoke_phone_numbers_sync() from public;
grant execute on function public.invoke_phone_numbers_sync() to postgres;

do $cron$
begin
  perform cron.unschedule('twilio-phone-numbers-sync');
exception
  when others then null;
end;
$cron$;

select cron.schedule(
  'twilio-phone-numbers-sync',
  '0 */6 * * *',
  $$select public.invoke_phone_numbers_sync();$$
);

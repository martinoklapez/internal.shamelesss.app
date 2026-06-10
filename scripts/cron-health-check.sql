-- Creator Pipeline cron health check (run in Supabase SQL Editor)
-- Outreach sends job: creator-pipeline-outreach-sends → process-creator-outreach-sends Edge

-- 1) Jobs registered and active
select jobid, jobname, schedule, active, command
from cron.job
where jobname like 'creator-pipeline-%'
order by jobname;

-- 2) Vault secrets (cron auth) — need 2 rows with exact names
select name, description, created_at, updated_at
from vault.secrets
where name in ('project_url', 'creator_outreach_cron_secret');

-- 2b) Decrypted readable? (if empty, run scripts/setup-cron-vault.sql + migration vault grants)
select name, left(decrypted_secret, 16) as prefix
from vault.decrypted_secrets
where name in ('project_url', 'creator_outreach_cron_secret');

-- 3) Recent cron runs (last 20) — status should be 'succeeded'
select
  j.jobname,
  d.status,
  d.start_time,
  d.end_time,
  d.return_message
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname like 'creator-pipeline-%'
order by d.start_time desc
limit 20;

-- 4) Failed cron runs only
select
  j.jobname,
  d.status,
  d.start_time,
  d.return_message
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname like 'creator-pipeline-%'
  and d.status = 'failed'
order by d.start_time desc
limit 10;

-- 5) pg_net HTTP responses to Edge (last 20) — outreach sends should be status_code 200
select
  id,
  status_code,
  timed_out,
  error_msg,
  left(content, 200) as content_preview,
  created
from net._http_response
where content like '%process-creator-outreach-sends%'
   or content like '%claimed%'
   or headers::text like '%outreach%'
order by created desc
limit 20;

-- Broader: all recent net responses (if filter above is empty)
-- select id, status_code, error_msg, left(content, 120), created
-- from net._http_response order by created desc limit 20;

-- 6) Queued vs sent outreach (pipeline outcome)
select status, count(*) as n
from creator_pipeline.outreach_sends
group by status
order by status;

select email, status, sent_at
from creator_pipeline.outreach_sends
where email = 'paulo.klapez+script@gmail.com'
order by sent_at desc
limit 5;

-- 7) Manual smoke test (fires Edge once, same as cron) — optional
-- select creator_pipeline.invoke_edge_function('process-creator-outreach-sends');
-- Then re-run sections 5–6 after ~5 seconds.

-- --- Cron not draining queued sends? ---
-- A) Vault missing → cron "succeeds" but NO http_post (check section 2; run section 7 — if null, vault broken)
-- B) Vault secret wrong → cron runs, net._http_response shows status_code 401
-- C) No cron runs in section 3 → job missing/disabled (re-run migration schedule blocks)
-- D) Edge OK but cron broken → npm run test:outreach-sends-edge sends; fix vault + section 3

-- Compare vault cron secret vs Edge (must match CREATOR_OUTREACH_CRON_SECRET):
-- select name, left(decrypted_secret, 8) as secret_prefix from vault.decrypted_secrets
-- where name = 'creator_outreach_cron_secret';

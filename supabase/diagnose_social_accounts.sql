-- =============================================================================
-- Diagnose social_accounts: find out what might have happened to missing rows
-- Run in Supabase SQL Editor (read-only; no data is changed).
-- If section 1 shows the table in "internal" schema, replace public with internal
-- in sections 2–9 (e.g. FROM internal.social_accounts).
-- =============================================================================

-- 1) Which schema has social_accounts?
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'social_accounts'
  AND n.nspname NOT LIKE 'pg_%';

-- 2) Current row count and breakdown (use the schema you use in app, e.g. public)
SELECT 'public.social_accounts' AS source,
       COUNT(*) AS total_rows,
       COUNT(*) FILTER (WHERE status::text = 'archived') AS archived,
       COUNT(*) FILTER (WHERE status::text = 'planned') AS planned,
       COUNT(*) FILTER (WHERE status::text = 'warmup') AS warmup,
       COUNT(*) FILTER (WHERE status::text = 'active') AS active,
       COUNT(*) FILTER (WHERE status::text = 'paused') AS paused,
       COUNT(*) FILTER (WHERE status::text = 'draft') AS draft,
       COUNT(*) FILTER (WHERE status IS NULL) AS status_null
FROM public.social_accounts;

-- 3) By platform
SELECT platform::text, status::text, COUNT(*) AS cnt
FROM public.social_accounts
GROUP BY 1, 2
ORDER BY 1, 2;

-- 4) Foreign keys that could CASCADE delete social_accounts (child side)
-- If a parent row is deleted with ON DELETE CASCADE, social_accounts rows go away
SELECT tc.constraint_name,
       tc.table_schema || '.' || tc.table_name AS child_table,
       kcu.column_name AS child_column,
       ccu.table_schema || '.' || ccu.table_name AS parent_table,
       ccu.column_name AS parent_column,
       rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name AND tc.constraint_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name AND ccu.constraint_schema = rc.unique_constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'social_accounts'
ORDER BY parent_table;

-- 5) Full list of social_accounts (ids, device, platform, status, created)
SELECT id,
       device_id,
       platform::text,
       username,
       status::text,
       created_at,
       updated_at
FROM public.social_accounts
ORDER BY device_id, platform::text, created_at;

-- 6) Per-device counts (devices with 0 accounts vs with accounts)
SELECT d.id AS device_id,
       COUNT(s.id) AS social_account_count
FROM public.devices d
LEFT JOIN public.social_accounts s ON s.device_id = d.id
GROUP BY d.id
ORDER BY d.id;

-- 7) Devices that have no social_accounts at all (might have had some deleted)
SELECT id AS device_id
FROM public.devices d
WHERE NOT EXISTS (SELECT 1 FROM public.social_accounts s WHERE s.device_id = d.id)
ORDER BY id;

-- 8) Triggers on social_accounts (could delete or change rows)
SELECT trigger_schema, trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'social_accounts';

-- 9) RLS policies (could hide rows from the app if USING changed)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'social_accounts';

-- 10) If you use Supabase Audit (pg_audit or supabase audit), uncomment and run:
-- SELECT * FROM audit.logged_actions
-- WHERE table_name = 'social_accounts' AND action = 'D'
-- ORDER BY action_tstamp DESC
-- LIMIT 100;

-- =============================================================================
-- BACKUPS: You cannot query backup content from SQL. Supabase stores backups
-- separately. To check or use them:
--
-- 1) Dashboard: Project → Database → Backups
--    - "Scheduled" = daily backups (Pro: 7 days, Team: 14, Enterprise: 30)
--    - "Point in Time" = PITR (if enabled): restore to any second in retention
--
-- 2) List backups via API (metadata only, not table content):
--    GET https://api.supabase.com/v1/projects/{ref}/database/backups
--    (use token from Dashboard → Account → Access Tokens)
--
-- 3) To see old table content: restore to a backup (replaces current DB) or
--    "Restore to new project" to clone at a point in time, then query that
--    project's social_accounts.
--
-- See supabase/BACKUPS.md for more detail.
-- =============================================================================

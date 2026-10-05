-- =============================================================================
-- Create a device: iPhone 11 Pro Max
-- Manager user id: 6c3faac8-a145-445a-aece-dfb325056759
--
-- Run in Supabase Dashboard → SQL Editor.
-- Edit owner below before running if needed.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Sanity check: confirm the manager user exists
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  manager_uuid uuid := '6c3faac8-a145-445a-aece-dfb325056759';
  manager_email text;
  manager_name text;
BEGIN
  SELECT u.email INTO manager_email
  FROM auth.users u
  WHERE u.id = manager_uuid;

  IF manager_email IS NULL THEN
    RAISE EXCEPTION 'Manager user % not found in auth.users', manager_uuid;
  END IF;

  SELECT p.name INTO manager_name
  FROM public.profiles p
  WHERE p.user_id = manager_uuid;

  RAISE NOTICE 'Manager: % (%), profile name: %',
    manager_uuid,
    manager_email,
    COALESCE(manager_name, '(no profile name)');
END $$;

-- ---------------------------------------------------------------------------
-- 2) Insert device
-- ---------------------------------------------------------------------------
INSERT INTO public.devices (
  device_model,
  manager_id,
  owner
)
VALUES (
  'iPhone 11 Pro Max',
  '6c3faac8-a145-445a-aece-dfb325056759'::uuid,
  COALESCE(
    (SELECT name FROM public.profiles WHERE user_id = '6c3faac8-a145-445a-aece-dfb325056759'::uuid),
    (SELECT email FROM auth.users WHERE id = '6c3faac8-a145-445a-aece-dfb325056759'::uuid),
    'Manager'
  )
)
RETURNING id, device_model, manager_id, owner, created_at;

COMMIT;

-- ---------------------------------------------------------------------------
-- 3) Verify (optional — run after commit)
-- ---------------------------------------------------------------------------
-- SELECT d.id, d.device_model, d.manager_id, d.owner, p.name AS manager_name
-- FROM public.devices d
-- LEFT JOIN public.profiles p ON p.user_id = d.manager_id
-- WHERE d.manager_id = '6c3faac8-a145-445a-aece-dfb325056759'
-- ORDER BY d.id DESC
-- LIMIT 5;

-- If public.devices is a read-only view, use this instead of step 2:
--
-- INSERT INTO internal.devices (device_model, manager_id, owner)
-- VALUES (
--   'iPhone 11 Pro Max',
--   '6c3faac8-a145-445a-aece-dfb325056759'::uuid,
--   COALESCE(
--     (SELECT name FROM public.profiles WHERE user_id = '6c3faac8-a145-445a-aece-dfb325056759'::uuid),
--     (SELECT email FROM auth.users WHERE id = '6c3faac8-a145-445a-aece-dfb325056759'::uuid),
--     'Manager'
--   )
-- )
-- RETURNING id, device_model, manager_id, owner, created_at;

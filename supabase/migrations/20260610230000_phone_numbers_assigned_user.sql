-- Assign phone numbers to panel users; scope access for promoters.

ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS phone_numbers_assigned_user_id_idx
  ON public.phone_numbers (assigned_user_id);

COMMENT ON COLUMN public.phone_numbers.assigned_user_id IS
  'Panel user who owns this number in inventory. Promoters only see numbers assigned to them or linked to devices they manage.';

-- Backfill from linked iCloud device manager
UPDATE public.phone_numbers pn
SET assigned_user_id = d.manager_id
FROM public.icloud_profiles ip
JOIN public.devices d ON d.id = ip.device_id
WHERE pn.icloud_profile_id = ip.id
  AND pn.assigned_user_id IS NULL
  AND d.manager_id IS NOT NULL;

-- Backfill from linked social account device manager
UPDATE public.phone_numbers pn
SET assigned_user_id = d.manager_id
FROM internal.social_accounts sa
JOIN public.devices d ON d.id = sa.device_id
WHERE sa.phone_number_id = pn.id
  AND pn.assigned_user_id IS NULL
  AND d.manager_id IS NOT NULL
  AND sa.status <> 'archived';

CREATE OR REPLACE FUNCTION public.is_phone_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_phone_number(p_phone_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.phone_numbers pn
    WHERE pn.id = p_phone_id
      AND (
        public.is_phone_admin()
        OR pn.assigned_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.icloud_profiles ip
          JOIN public.devices d ON d.id = ip.device_id
          WHERE ip.id = pn.icloud_profile_id
            AND d.manager_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.social_accounts sa
          JOIN public.devices d ON d.id = sa.device_id
          WHERE sa.phone_number_id = pn.id
            AND sa.status <> 'archived'
            AND d.manager_id = auth.uid()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_phone_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_phone_number(uuid) TO authenticated;

-- Replace open RLS policies
DROP POLICY IF EXISTS phone_numbers_select_authenticated ON public.phone_numbers;
DROP POLICY IF EXISTS phone_numbers_insert_authenticated ON public.phone_numbers;
DROP POLICY IF EXISTS phone_numbers_update_authenticated ON public.phone_numbers;
DROP POLICY IF EXISTS phone_numbers_delete_authenticated ON public.phone_numbers;

CREATE POLICY phone_numbers_select_scoped ON public.phone_numbers
  FOR SELECT TO authenticated
  USING (public.can_access_phone_number(id));

CREATE POLICY phone_numbers_insert_admin ON public.phone_numbers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_phone_admin());

CREATE POLICY phone_numbers_update_scoped ON public.phone_numbers
  FOR UPDATE TO authenticated
  USING (public.can_access_phone_number(id))
  WITH CHECK (public.can_access_phone_number(id));

CREATE POLICY phone_numbers_delete_admin ON public.phone_numbers
  FOR DELETE TO authenticated
  USING (public.is_phone_admin());

DROP POLICY IF EXISTS sms_messages_select_authenticated ON public.sms_messages;
DROP POLICY IF EXISTS sms_messages_insert_authenticated ON public.sms_messages;
DROP POLICY IF EXISTS sms_messages_update_authenticated ON public.sms_messages;

CREATE POLICY sms_messages_select_scoped ON public.sms_messages
  FOR SELECT TO authenticated
  USING (public.can_access_phone_number(phone_number_id));

CREATE POLICY sms_messages_insert_scoped ON public.sms_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_phone_number(phone_number_id));

CREATE POLICY sms_messages_update_scoped ON public.sms_messages
  FOR UPDATE TO authenticated
  USING (public.can_access_phone_number(phone_number_id))
  WITH CHECK (public.can_access_phone_number(phone_number_id));

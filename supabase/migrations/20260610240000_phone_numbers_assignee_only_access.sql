-- Non-admins access phone numbers by assignee only (not device link).

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
      AND ur.role IN ('admin', 'dev', 'developer')
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
      )
  );
$$;

COMMENT ON COLUMN public.phone_numbers.assigned_user_id IS
  'Panel user who owns this number. Non-admins only see and use SMS for numbers assigned to them.';

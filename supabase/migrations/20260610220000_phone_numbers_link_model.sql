-- Phone numbers link to iCloud profiles and social accounts, not directly to devices.
-- public.social_accounts is a view → column lives on internal.social_accounts.

ALTER TABLE internal.social_accounts
  ADD COLUMN IF NOT EXISTS phone_number_id uuid REFERENCES public.phone_numbers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS social_accounts_phone_number_id_idx
  ON internal.social_accounts (phone_number_id);

-- Recreate public view so phone_number_id is visible to the app.
DROP VIEW IF EXISTS public.social_accounts;
CREATE VIEW public.social_accounts AS
  SELECT * FROM internal.social_accounts;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;

-- Move legacy phone_numbers.social_account_id → internal.social_accounts.phone_number_id
UPDATE internal.social_accounts sa
SET phone_number_id = pn.id
FROM public.phone_numbers pn
WHERE pn.social_account_id = sa.id
  AND sa.phone_number_id IS NULL;

-- Legacy device_id → link to active iCloud profile on that device (best-effort)
UPDATE public.phone_numbers pn
SET icloud_profile_id = ip.id
FROM public.icloud_profiles ip
WHERE pn.device_id IS NOT NULL
  AND pn.device_id = ip.device_id
  AND ip.status = 'active'
  AND pn.icloud_profile_id IS NULL;

DROP INDEX IF EXISTS public.phone_numbers_device_id_idx;
DROP INDEX IF EXISTS public.phone_numbers_batch_id_idx;

ALTER TABLE public.phone_numbers DROP COLUMN IF EXISTS device_id;
ALTER TABLE public.phone_numbers DROP COLUMN IF EXISTS social_account_id;
ALTER TABLE public.phone_numbers DROP COLUMN IF EXISTS batch_id;

-- At most one active phone per iCloud profile
CREATE UNIQUE INDEX IF NOT EXISTS phone_numbers_icloud_profile_active_unique
  ON public.phone_numbers (icloud_profile_id)
  WHERE icloud_profile_id IS NOT NULL AND status <> 'released';

COMMENT ON COLUMN internal.social_accounts.phone_number_id IS
  'Twilio number used to create or verify this social account.';
COMMENT ON COLUMN public.phone_numbers.icloud_profile_id IS
  'Optional link to the iCloud profile this number is used for (signup/2FA).';

-- Missive shared email account ID (Settings → API → Resource IDs) per sender.

ALTER TABLE creator_pipeline.send_from_addresses
  ADD COLUMN IF NOT EXISTS missive_account_id text NULL;

COMMENT ON COLUMN creator_pipeline.send_from_addresses.missive_account_id IS
  'Missive shared Gmail account UUID for this From address (Resource IDs). Passed as drafts.account when set.';

UPDATE creator_pipeline.send_from_addresses
SET missive_account_id = '46396c31-9a60-4c69-9693-79004c637731'
WHERE address = 'valerius@creators.shamelesss.app'
  AND (missive_account_id IS NULL OR missive_account_id = '');

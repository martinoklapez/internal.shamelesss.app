ALTER TABLE creator_pipeline.contacts
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';

COMMENT ON COLUMN creator_pipeline.contacts.phone IS
  'E.164 phone number (e.g. +14155552671). Empty when unknown.';

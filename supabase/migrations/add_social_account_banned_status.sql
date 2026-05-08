-- Add banned status for accounts removed or restricted by the platform.
-- Must run in its own migration (enum value add cannot be rolled into dependent updates in all PG versions).

ALTER TYPE internal.social_account_status ADD VALUE IF NOT EXISTS 'banned';

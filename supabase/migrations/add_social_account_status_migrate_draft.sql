-- Part 2/2: Migrate existing 'draft' to 'planned'.
-- Run after add_social_account_status_values.sql has been committed.

UPDATE public.social_accounts
SET status = 'planned'::internal.social_account_status
WHERE status::text = 'draft';

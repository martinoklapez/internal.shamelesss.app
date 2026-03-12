-- Part 1/2: Add new enum values to internal.social_account_status.
-- Must be committed before part 2 (new enum values cannot be used in the same transaction).

ALTER TYPE internal.social_account_status ADD VALUE IF NOT EXISTS 'planned';
ALTER TYPE internal.social_account_status ADD VALUE IF NOT EXISTS 'warmup';
ALTER TYPE internal.social_account_status ADD VALUE IF NOT EXISTS 'paused';

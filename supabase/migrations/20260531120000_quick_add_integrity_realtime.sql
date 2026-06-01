-- Quick Add integrity metadata + realtime for multi-user optimistic UI.

ALTER TABLE creator_pipeline.quick_add_jobs
  ADD COLUMN IF NOT EXISTS review_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_confirm_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid NULL;

COMMENT ON COLUMN creator_pipeline.quick_add_jobs.review_required IS
  'When true, UI must show human review before confirm (queue conflicts, fuzzy match, etc.).';
COMMENT ON COLUMN creator_pipeline.quick_add_jobs.auto_confirm_eligible IS
  'When true and review_required false, safe for auto-accept mode (existing profile + link only).';
COMMENT ON COLUMN creator_pipeline.quick_add_jobs.plan_warnings IS
  'JSON array of { code, message, severity } from queue-aware planning.';

-- Team-visible job updates (enqueue, scrape ready, confirm).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE creator_pipeline.quick_add_jobs;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication missing — enable Realtime for creator_pipeline.quick_add_jobs in Dashboard';
END $$;

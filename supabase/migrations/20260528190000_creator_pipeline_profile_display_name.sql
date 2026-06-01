ALTER TABLE creator_pipeline.profiles
  ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '';

COMMENT ON COLUMN creator_pipeline.profiles.display_name IS
  'Platform display name / nickname (e.g. from TikTok nickname or Instagram full name).';

-- Optional manual creator photo: pick from linked profiles; NULL = first linked profile by scouted_at

ALTER TABLE creator_pipeline.creators
  ADD COLUMN IF NOT EXISTS avatar_profile_id uuid NULL
  REFERENCES creator_pipeline.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN creator_pipeline.creators.avatar_profile_id IS
  'Profile whose avatar_url is shown for this creator. NULL uses the earliest scouted linked profile.';

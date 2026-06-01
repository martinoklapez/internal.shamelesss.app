-- Profile avatar URL + public storage bucket for creator pipeline social avatars

ALTER TABLE creator_pipeline.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text NULL;

COMMENT ON COLUMN creator_pipeline.profiles.avatar_url IS
  'Public Supabase Storage URL for cached profile picture (creator-pipeline-avatars bucket).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creator-pipeline-avatars',
  'creator-pipeline-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "creator_pipeline_avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "creator_pipeline_avatars_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "creator_pipeline_avatars_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "creator_pipeline_avatars_authenticated_delete" ON storage.objects;

CREATE POLICY "creator_pipeline_avatars_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'creator-pipeline-avatars');

CREATE POLICY "creator_pipeline_avatars_authenticated_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'creator-pipeline-avatars'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "creator_pipeline_avatars_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'creator-pipeline-avatars'
  AND auth.uid() IS NOT NULL
)
WITH CHECK (bucket_id = 'creator-pipeline-avatars');

CREATE POLICY "creator_pipeline_avatars_authenticated_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'creator-pipeline-avatars'
  AND auth.uid() IS NOT NULL
);

-- Public image bucket for Creator Pipeline email assets (sender photos, signature logos).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creator-pipeline-assets',
  'creator-pipeline-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "creator_pipeline_assets_public_read" ON storage.objects;
DROP POLICY IF EXISTS "creator_pipeline_assets_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "creator_pipeline_assets_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "creator_pipeline_assets_authenticated_delete" ON storage.objects;

CREATE POLICY "creator_pipeline_assets_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'creator-pipeline-assets');

CREATE POLICY "creator_pipeline_assets_authenticated_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'creator-pipeline-assets'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "creator_pipeline_assets_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'creator-pipeline-assets'
  AND auth.uid() IS NOT NULL
)
WITH CHECK (bucket_id = 'creator-pipeline-assets');

CREATE POLICY "creator_pipeline_assets_authenticated_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'creator-pipeline-assets'
  AND auth.uid() IS NOT NULL
);

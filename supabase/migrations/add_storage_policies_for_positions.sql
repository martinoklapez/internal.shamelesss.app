-- Storage Bucket Policies for poses (Scratch Dates)
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload poses"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'poses' 
  AND auth.uid() IS NOT NULL
);

-- Allow public read access
CREATE POLICY "Allow public read access to poses"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'poses');

-- Allow authenticated users to delete files
CREATE POLICY "Allow authenticated users to delete poses"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'poses' 
  AND auth.uid() IS NOT NULL
);

-- Storage Bucket Policies for date-roulette-poses (DateRoulette)
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload date-roulette-poses"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'date-roulette-poses' 
  AND auth.uid() IS NOT NULL
);

-- Allow public read access
CREATE POLICY "Allow public read access to date-roulette-poses"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'date-roulette-poses');

-- Allow authenticated users to delete files
CREATE POLICY "Allow authenticated users to delete date-roulette-poses"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'date-roulette-poses' 
  AND auth.uid() IS NOT NULL
);


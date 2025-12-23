# Storage Buckets Setup

Create the following storage buckets in your Supabase project:

## Required Buckets

1. **character-references**
   - Public: Yes
   - File size limit: 10MB (recommended)
   - Allowed MIME types: image/*

2. **character-generated**
   - Public: Yes
   - File size limit: 10MB (recommended)
   - Allowed MIME types: image/*

## Setup Instructions

1. Go to your Supabase Dashboard
2. Navigate to Storage
3. Click "New bucket"
4. Create each bucket with the settings above
5. Make sure both buckets are set to Public

## Storage Bucket Policies (RLS)

After creating the buckets, you need to set up storage policies. Run this SQL in Supabase Dashboard > SQL Editor:

```sql
-- Storage Bucket Policies for character-references
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload reference images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'character-references' 
  AND auth.uid() IS NOT NULL
);

-- Allow public read access
CREATE POLICY "Allow public read access to reference images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'character-references');

-- Allow authenticated users to delete files
CREATE POLICY "Allow authenticated users to delete reference images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'character-references' 
  AND auth.uid() IS NOT NULL
);

-- Storage Bucket Policies for character-generated
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload generated images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'character-generated' 
  AND auth.uid() IS NOT NULL
);

-- Allow public read access
CREATE POLICY "Allow public read access to generated images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'character-generated');

-- Allow authenticated users to delete files
CREATE POLICY "Allow authenticated users to delete generated images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'character-generated' 
  AND auth.uid() IS NOT NULL
);
```

**Note:** If policies already exist, you may need to drop them first:
```sql
-- Drop existing policies if needed
DROP POLICY IF EXISTS "Allow authenticated users to upload reference images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to reference images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete reference images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload generated images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to generated images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete generated images" ON storage.objects;
```


-- Quick fix for INSERT policies only
-- Run this in Supabase Dashboard > SQL Editor if INSERT policies are not working correctly

BEGIN;

-- Drop all existing INSERT policies (handles any naming variations)
DROP POLICY IF EXISTS "Allow authenticated users to insert characters" ON public.ai_characters;
DROP POLICY IF EXISTS "Allow authenticated users to insert reference images" ON public.character_reference_images;
DROP POLICY IF EXISTS "Allow authenticated users to insert generated images" ON public.character_generated_images;

-- Recreate INSERT policies with explicit WITH CHECK clause
CREATE POLICY "Allow authenticated users to insert characters" ON public.ai_characters
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to insert reference images" ON public.character_reference_images
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to insert generated images" ON public.character_generated_images
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

COMMIT;

-- Verify the fix
SELECT 
  tablename, 
  policyname, 
  cmd,
  with_check as with_check_clause,
  CASE 
    WHEN with_check LIKE '%auth.uid()%' THEN '✓ Fixed'
    ELSE '✗ Still broken'
  END as status
FROM pg_policies 
WHERE tablename IN ('ai_characters', 'character_reference_images', 'character_generated_images')
  AND schemaname = 'public'
  AND cmd = 'INSERT'
ORDER BY tablename;


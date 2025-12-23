-- Robust fix for INSERT policies
-- This script ensures all INSERT policies are properly recreated with auth.uid() check
-- Run this in Supabase Dashboard > SQL Editor

BEGIN;

-- Drop all INSERT policies using a dynamic approach to catch any variations
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop INSERT policies for ai_characters
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'ai_characters' 
          AND schemaname = 'public'
          AND cmd = 'INSERT'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_characters', r.policyname);
        RAISE NOTICE 'Dropped policy: % on ai_characters', r.policyname;
    END LOOP;
    
    -- Drop INSERT policies for character_reference_images
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'character_reference_images' 
          AND schemaname = 'public'
          AND cmd = 'INSERT'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.character_reference_images', r.policyname);
        RAISE NOTICE 'Dropped policy: % on character_reference_images', r.policyname;
    END LOOP;
    
    -- Drop INSERT policies for character_generated_images
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'character_generated_images' 
          AND schemaname = 'public'
          AND cmd = 'INSERT'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.character_generated_images', r.policyname);
        RAISE NOTICE 'Dropped policy: % on character_generated_images', r.policyname;
    END LOOP;
END $$;

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

-- Verify the policies were created correctly
DO $$
DECLARE
    policy_count INTEGER;
    correct_count INTEGER;
BEGIN
    -- Count total INSERT policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE tablename IN ('ai_characters', 'character_reference_images', 'character_generated_images')
      AND schemaname = 'public'
      AND cmd = 'INSERT';
    
    -- Count policies with correct WITH CHECK clause
    SELECT COUNT(*) INTO correct_count
    FROM pg_policies 
    WHERE tablename IN ('ai_characters', 'character_reference_images', 'character_generated_images')
      AND schemaname = 'public'
      AND cmd = 'INSERT'
      AND with_check LIKE '%auth.uid()%';
    
    IF policy_count = 3 AND correct_count = 3 THEN
        RAISE NOTICE '✓ Success! All 3 INSERT policies created correctly with auth.uid() check';
    ELSE
        RAISE WARNING '⚠ Warning: Expected 3 policies with auth.uid(), but found % out of % total', correct_count, policy_count;
    END IF;
END $$;

-- Show the final state
SELECT 
  tablename, 
  policyname, 
  cmd,
  with_check as with_check_clause,
  CASE 
    WHEN with_check LIKE '%auth.uid()%' THEN '✓ CORRECT'
    ELSE '✗ INCORRECT'
  END as status
FROM pg_policies 
WHERE tablename IN ('ai_characters', 'character_reference_images', 'character_generated_images')
  AND schemaname = 'public'
  AND cmd = 'INSERT'
ORDER BY tablename;

COMMIT;


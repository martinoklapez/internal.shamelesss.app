-- Complete fix for RLS policies for AI characters tables
-- This script will:
-- 1. Drop ALL existing policies (including any with different names)
-- 2. Recreate them with the correct auth.uid() IS NOT NULL check
-- 
-- Run this in Supabase Dashboard > SQL Editor

-- Step 1: Drop ALL existing policies using a dynamic approach
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop policies for ai_characters
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'ai_characters' AND schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_characters', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
    
    -- Drop policies for character_reference_images
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'character_reference_images' AND schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.character_reference_images', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
    
    -- Drop policies for character_generated_images
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'character_generated_images' AND schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.character_generated_images', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.ai_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_reference_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_generated_images ENABLE ROW LEVEL SECURITY;

-- Step 3: Create new policies for ai_characters
CREATE POLICY "Allow authenticated users to read characters" ON public.ai_characters
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT policy with explicit WITH CHECK clause
DROP POLICY IF EXISTS "Allow authenticated users to insert characters" ON public.ai_characters;
CREATE POLICY "Allow authenticated users to insert characters" ON public.ai_characters
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update characters" ON public.ai_characters
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete characters" ON public.ai_characters
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Step 4: Create new policies for character_reference_images
CREATE POLICY "Allow authenticated users to read reference images" ON public.character_reference_images
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT policy with explicit WITH CHECK clause
DROP POLICY IF EXISTS "Allow authenticated users to insert reference images" ON public.character_reference_images;
CREATE POLICY "Allow authenticated users to insert reference images" ON public.character_reference_images
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update reference images" ON public.character_reference_images
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete reference images" ON public.character_reference_images
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Step 5: Create new policies for character_generated_images
CREATE POLICY "Allow authenticated users to read generated images" ON public.character_generated_images
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT policy with explicit WITH CHECK clause
DROP POLICY IF EXISTS "Allow authenticated users to insert generated images" ON public.character_generated_images;
CREATE POLICY "Allow authenticated users to insert generated images" ON public.character_generated_images
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update generated images" ON public.character_generated_images
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete generated images" ON public.character_generated_images
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Step 6: Verify policies were created correctly
SELECT 
  tablename, 
  policyname, 
  cmd,
  CASE 
    WHEN cmd = 'INSERT' THEN
      CASE 
        WHEN with_check LIKE '%auth.uid()%' THEN '✓ Uses auth.uid() in WITH CHECK'
        ELSE '✗ Does not use auth.uid() in WITH CHECK'
      END
    ELSE
      CASE 
        WHEN qual LIKE '%auth.uid()%' THEN '✓ Uses auth.uid() in USING'
        ELSE '✗ Does not use auth.uid() in USING'
      END
  END as auth_check,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies 
WHERE tablename IN ('ai_characters', 'character_reference_images', 'character_generated_images')
  AND schemaname = 'public'
ORDER BY tablename, cmd, policyname;


-- COMPLETE RESET of all RLS policies for AI characters tables
-- This will drop ALL policies and recreate them from scratch
-- Run this in Supabase Dashboard > SQL Editor

BEGIN;

-- Step 1: Drop ALL existing policies (using dynamic approach to catch any variations)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies for ai_characters
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'ai_characters' 
          AND schemaname = 'public'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_characters', r.policyname);
        RAISE NOTICE 'Dropped policy: % on ai_characters', r.policyname;
    END LOOP;
    
    -- Drop all policies for character_reference_images
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'character_reference_images' 
          AND schemaname = 'public'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.character_reference_images', r.policyname);
        RAISE NOTICE 'Dropped policy: % on character_reference_images', r.policyname;
    END LOOP;
    
    -- Drop all policies for character_generated_images
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'character_generated_images' 
          AND schemaname = 'public'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.character_generated_images', r.policyname);
        RAISE NOTICE 'Dropped policy: % on character_generated_images', r.policyname;
    END LOOP;
END $$;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.ai_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_reference_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_generated_images ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policies for ai_characters
CREATE POLICY "Allow authenticated users to read characters" ON public.ai_characters
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to insert characters" ON public.ai_characters
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update characters" ON public.ai_characters
  FOR UPDATE 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete characters" ON public.ai_characters
  FOR DELETE 
  USING (auth.uid() IS NOT NULL);

-- Step 4: Create policies for character_reference_images
CREATE POLICY "Allow authenticated users to read reference images" ON public.character_reference_images
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to insert reference images" ON public.character_reference_images
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update reference images" ON public.character_reference_images
  FOR UPDATE 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete reference images" ON public.character_reference_images
  FOR DELETE 
  USING (auth.uid() IS NOT NULL);

-- Step 5: Create policies for character_generated_images
CREATE POLICY "Allow authenticated users to read generated images" ON public.character_generated_images
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to insert generated images" ON public.character_generated_images
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update generated images" ON public.character_generated_images
  FOR UPDATE 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete generated images" ON public.character_generated_images
  FOR DELETE 
  USING (auth.uid() IS NOT NULL);

-- Step 6: Verify all policies were created correctly
SELECT 
  tablename,
  cmd,
  policyname,
  CASE 
    WHEN cmd = 'INSERT' THEN
      CASE 
        WHEN with_check LIKE '%auth.uid()%' THEN '✓ CORRECT'
        ELSE '✗ MISSING WITH CHECK'
      END
    WHEN cmd = 'UPDATE' THEN
      CASE 
        WHEN qual LIKE '%auth.uid()%' AND with_check LIKE '%auth.uid()%' THEN '✓ CORRECT'
        ELSE '✗ MISSING CHECK'
      END
    ELSE
      CASE 
        WHEN qual LIKE '%auth.uid()%' THEN '✓ CORRECT'
        ELSE '✗ MISSING USING'
      END
  END as status,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies 
WHERE tablename IN ('ai_characters', 'character_reference_images', 'character_generated_images')
  AND schemaname = 'public'
ORDER BY tablename, cmd, policyname;

COMMIT;


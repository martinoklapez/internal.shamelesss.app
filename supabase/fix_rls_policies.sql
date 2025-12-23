-- Fix RLS policies for AI characters tables
-- Run this in Supabase SQL Editor if you're still getting RLS policy violations
-- 
-- IMPORTANT: Make sure you're running this as a superuser or with proper permissions
-- If you get permission errors, you may need to use the Supabase Dashboard SQL Editor

-- Drop all existing policies (including any with different names)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename 
              FROM pg_policies 
              WHERE tablename IN ('ai_characters', 'character_reference_images', 'character_generated_images')
                AND schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Drop all existing policies (explicit names as backup)
DROP POLICY IF EXISTS "Allow authenticated users to read characters" ON public.ai_characters;
DROP POLICY IF EXISTS "Allow authenticated users to insert characters" ON public.ai_characters;
DROP POLICY IF EXISTS "Allow authenticated users to update characters" ON public.ai_characters;
DROP POLICY IF EXISTS "Allow authenticated users to delete characters" ON public.ai_characters;

DROP POLICY IF EXISTS "Allow authenticated users to read reference images" ON public.character_reference_images;
DROP POLICY IF EXISTS "Allow authenticated users to insert reference images" ON public.character_reference_images;
DROP POLICY IF EXISTS "Allow authenticated users to update reference images" ON public.character_reference_images;
DROP POLICY IF EXISTS "Allow authenticated users to delete reference images" ON public.character_reference_images;

DROP POLICY IF EXISTS "Allow authenticated users to read generated images" ON public.character_generated_images;
DROP POLICY IF EXISTS "Allow authenticated users to insert generated images" ON public.character_generated_images;
DROP POLICY IF EXISTS "Allow authenticated users to update generated images" ON public.character_generated_images;
DROP POLICY IF EXISTS "Allow authenticated users to delete generated images" ON public.character_generated_images;

-- Recreate policies with auth.uid() IS NOT NULL
CREATE POLICY "Allow authenticated users to read characters" ON public.ai_characters
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to insert characters" ON public.ai_characters
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update characters" ON public.ai_characters
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete characters" ON public.ai_characters
  FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to read reference images" ON public.character_reference_images
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to insert reference images" ON public.character_reference_images
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update reference images" ON public.character_reference_images
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete reference images" ON public.character_reference_images
  FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to read generated images" ON public.character_generated_images
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to insert generated images" ON public.character_generated_images
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update generated images" ON public.character_generated_images
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete generated images" ON public.character_generated_images
  FOR DELETE USING (auth.uid() IS NOT NULL);


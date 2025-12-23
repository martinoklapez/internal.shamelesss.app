-- Test script to verify RLS policies and auth context
-- Run this in Supabase SQL Editor to check the current state

-- 1. Check current policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('ai_characters', 'character_reference_images', 'character_generated_images')
ORDER BY tablename, policyname;

-- 2. Test if auth.uid() is accessible (this should return your user ID if you're logged in)
SELECT auth.uid() as current_user_id;

-- 3. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('ai_characters', 'character_reference_images', 'character_generated_images')
  AND schemaname = 'public';


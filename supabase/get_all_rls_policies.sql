-- Get all RLS policies for AI characters tables
-- Run this and send the results for analysis

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_clause,
  with_check as with_check_clause,
  -- Show if RLS is enabled
  (SELECT rowsecurity 
   FROM pg_tables 
   WHERE schemaname = p.schemaname 
     AND tablename = p.tablename) as rls_enabled
FROM pg_policies p
WHERE tablename IN ('ai_characters', 'character_reference_images', 'character_generated_images')
  AND schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- Also get the table-level RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('ai_characters', 'character_reference_images', 'character_generated_images')
  AND schemaname = 'public'
ORDER BY tablename;

-- Check if there are any conflicting policies or issues
SELECT 
  tablename,
  COUNT(*) as policy_count,
  COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) as select_policies,
  COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) as insert_policies,
  COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) as update_policies,
  COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) as delete_policies,
  COUNT(CASE WHEN cmd = 'INSERT' AND with_check LIKE '%auth.uid()%' THEN 1 END) as insert_with_auth_check
FROM pg_policies
WHERE tablename IN ('ai_characters', 'character_reference_images', 'character_generated_images')
  AND schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;


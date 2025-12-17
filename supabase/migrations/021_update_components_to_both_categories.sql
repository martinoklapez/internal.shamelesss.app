-- Update all components to be available for both quiz and conversion screens
-- Then remove the deprecated 'category' column

-- Step 1: Update all components to have both categories
UPDATE public.onboarding_components 
SET categories = ARRAY['quiz', 'conversion']::text[],
    updated_at = timezone('utc'::text, now())
WHERE array_length(categories, 1) = 1; -- Only update if currently has single category

-- Step 2: Drop the old 'category' column (no longer needed)
ALTER TABLE public.onboarding_components 
DROP COLUMN IF EXISTS category;

-- Step 3: Drop the old category index (no longer needed)
DROP INDEX IF EXISTS idx_onboarding_components_category;

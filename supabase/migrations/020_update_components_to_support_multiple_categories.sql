-- Update onboarding_components to support multiple categories per component
-- This allows components to be available for both quiz and conversion screens

-- Step 1: Add a new column for array of categories
ALTER TABLE public.onboarding_components 
ADD COLUMN IF NOT EXISTS categories text[] DEFAULT ARRAY[]::text[];

-- Step 2: Migrate existing category data to categories array
UPDATE public.onboarding_components 
SET categories = ARRAY[category]::text[]
WHERE categories = ARRAY[]::text[] OR categories IS NULL;

-- Step 3: Add check constraint for categories array
ALTER TABLE public.onboarding_components
ADD CONSTRAINT onboarding_components_categories_check 
CHECK (
  array_length(categories, 1) > 0 
  AND categories <@ ARRAY['quiz', 'conversion']::text[]
);

-- Step 4: Create index for array queries
CREATE INDEX IF NOT EXISTS idx_onboarding_components_categories 
ON public.onboarding_components USING GIN (categories);

-- Step 5: Make categories NOT NULL (after migration)
ALTER TABLE public.onboarding_components
ALTER COLUMN categories SET NOT NULL;

-- Step 6: Drop the old category column (optional - we can keep it for backward compatibility or drop it)
-- For now, we'll keep it but mark it as deprecated
COMMENT ON COLUMN public.onboarding_components.category IS 'DEPRECATED: Use categories array instead. This column will be removed in a future migration.';

-- Note: The old 'category' column is kept for backward compatibility
-- You can drop it later once all code is updated to use 'categories'


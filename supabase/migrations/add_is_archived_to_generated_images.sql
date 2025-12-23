-- Add is_archived column to character_generated_images table
ALTER TABLE public.character_generated_images
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Create index for better query performance when filtering archived images
CREATE INDEX IF NOT EXISTS idx_character_generated_images_is_archived 
ON public.character_generated_images(character_id, is_archived);

-- Update existing rows to have is_archived = false
UPDATE public.character_generated_images
SET is_archived = FALSE
WHERE is_archived IS NULL;


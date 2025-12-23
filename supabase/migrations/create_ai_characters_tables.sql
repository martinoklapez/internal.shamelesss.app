-- Create ai_characters table
CREATE TABLE IF NOT EXISTS public.ai_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create character_reference_images table
CREATE TABLE IF NOT EXISTS public.character_reference_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.ai_characters(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create character_generated_images table
CREATE TABLE IF NOT EXISTS public.character_generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.ai_characters(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  replicate_prediction_id TEXT,
  generation_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, generation_number)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_character_reference_images_character_id ON public.character_reference_images(character_id);
CREATE INDEX IF NOT EXISTS idx_character_reference_images_is_default ON public.character_reference_images(character_id, is_default);
CREATE INDEX IF NOT EXISTS idx_character_generated_images_character_id ON public.character_generated_images(character_id);
CREATE INDEX IF NOT EXISTS idx_character_generated_images_generation_number ON public.character_generated_images(character_id, generation_number);

-- Enable Row Level Security
ALTER TABLE public.ai_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_reference_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_generated_images ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
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

-- Create RLS policies (allow authenticated users to read/write)
-- Using auth.uid() IS NOT NULL is the standard way to check for authenticated users
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


-- Create onboarding_components table to store available component registry
CREATE TABLE IF NOT EXISTS public.onboarding_components (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  component_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('quiz', 'conversion')),
  description text,
  props_schema jsonb,
  default_options jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT onboarding_components_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_components_category ON public.onboarding_components(category);
CREATE INDEX IF NOT EXISTS idx_onboarding_components_key ON public.onboarding_components(component_key);

-- Enable RLS
ALTER TABLE public.onboarding_components ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read components
CREATE POLICY "Allow authenticated users to read onboarding_components"
  ON public.onboarding_components
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow admin/developer to manage components
CREATE POLICY "Allow developers to manage onboarding_components"
  ON public.onboarding_components
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'developer')
    )
  );

COMMENT ON TABLE public.onboarding_components IS 'Registry of available onboarding screen components from the mobile app';
COMMENT ON COLUMN public.onboarding_components.component_key IS 'Unique identifier matching the component_key in the mobile app';
COMMENT ON COLUMN public.onboarding_components.component_name IS 'Human-readable name for the component';
COMMENT ON COLUMN public.onboarding_components.category IS 'Whether this is a quiz or conversion screen component';
COMMENT ON COLUMN public.onboarding_components.props_schema IS 'JSON schema describing the expected props structure';
COMMENT ON COLUMN public.onboarding_components.default_options IS 'Default values for the options JSONB field';


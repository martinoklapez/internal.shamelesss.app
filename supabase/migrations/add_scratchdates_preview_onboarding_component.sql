-- Add ScratchDates Preview to onboarding_components so it appears in the component dropdown.
-- Options: image_url (required), title (optional). Used in both quiz and conversion flows.

INSERT INTO onboarding_components (
  component_key,
  component_name,
  description,
  categories,
  default_options
)
SELECT
  'scratchdates_preview',
  'ScratchDates Preview',
  'Scratch-off card to preview a position from ScratchDates. Options: image_url (required), title (optional).',
  ARRAY['quiz', 'conversion']::text[],
  '{"image_url": "", "title": ""}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM onboarding_components WHERE component_key = 'scratchdates_preview'
);

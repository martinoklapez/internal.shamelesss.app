-- Data consents screen: conversion funnel only. options must be a JSON object (not a top-level array).

INSERT INTO public.onboarding_components (
  component_key,
  component_name,
  description,
  categories,
  default_options
)
SELECT
  'data_consents',
  'Data consents',
  'Consent checkboxes + Accept all + Next. Conversion only. options jsonb: object with consents[] (id, title, description?, required?, learn_more?), accept_all_label, next_button_label — not a top-level array.',
  ARRAY['conversion']::text[],
  '{"consents":[{"id":"privacy","title":"Privacy & data use","description":"Plain text body under the title.","required":true,"learn_more":{"label":"Learn more","url":"https://example.com/privacy"}}],"accept_all_label":"Accept All","next_button_label":"Next"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_components WHERE component_key = 'data_consents'
);

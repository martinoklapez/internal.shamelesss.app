-- country_select + gender_select: conversion funnel only (quiz gallery/API exclude via categories + isAllowedQuizComponent)

INSERT INTO public.onboarding_components (component_key, component_name, description, categories, default_options)
SELECT * FROM (VALUES
  ('country_select', 'Country Select', 'Country selection screen. Conversion funnel only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('gender_select', 'Gender Select', 'Gender selection screen. Conversion funnel only.', ARRAY['conversion']::text[], '{}'::jsonb)
) AS v(component_key, component_name, description, categories, default_options)
WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_components c WHERE c.component_key = v.component_key);

UPDATE public.onboarding_components c SET
  component_name = v.component_name,
  description = v.description,
  categories = v.categories,
  default_options = v.default_options
FROM (VALUES
  ('country_select', 'Country Select', 'Country selection screen. Conversion funnel only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('gender_select', 'Gender Select', 'Gender selection screen. Conversion funnel only.', ARRAY['conversion']::text[], '{}'::jsonb)
) AS v(component_key, component_name, description, categories, default_options)
WHERE c.component_key = v.component_key;

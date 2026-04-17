-- Optional QA script (not a migration): example INSERT for conversion_screens_staging.
-- Uncomment and adjust order_position before running.

/*
INSERT INTO public.conversion_screens_staging (
  title,
  description,
  options,
  order_position,
  event_name,
  should_show,
  component_id
) VALUES (
  'Before we continue',
  'Review and accept the following.',
  jsonb_build_object(
    'consents',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'privacy',
        'title', 'Privacy & data use',
        'description', 'Plain text body under the title.',
        'required', true,
        'learn_more', jsonb_build_object('label', 'Learn more', 'url', 'https://example.com/privacy')
      ),
      jsonb_build_object(
        'id', 'marketing',
        'title', 'Marketing messages',
        'description', 'Optional — you can skip.',
        'required', false
      )
    ),
    'accept_all_label', 'Accept All',
    'next_button_label', 'Next'
  ),
  99,
  'step',
  true,
  'data_consents'
);
*/

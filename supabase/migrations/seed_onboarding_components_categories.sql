-- Seed onboarding_components so all supported components exist and flow (quiz vs conversion)
-- is controlled only by the categories column. Run after table exists.
-- Components in 'quiz' can be added to quiz screens; in 'conversion' to conversion screens;
-- in both to either. Uses INSERT ... WHERE NOT EXISTS so safe without unique constraint.

INSERT INTO public.onboarding_components (component_key, component_name, description, categories, default_options)
SELECT * FROM (VALUES
  ('rate_app', 'Rate App', 'Triggers Store Review prompt. Quiz only.', ARRAY['quiz']::text[], '{}'::jsonb),
  ('age_input_picker', 'Age Input (Picker)', 'Native age picker (14–120). Conversion only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('age_input_scroll', 'Age Input (Scroll)', 'Scrollable age picker (12–120).', ARRAY['conversion']::text[], '{}'::jsonb),
  ('quiz_results', 'Quiz Results', 'Two-bar chart. Conversion only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('rate_app_blurred', 'Rate App (Blurred)', 'In-app review with blur. Conversion only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('rate_app_default', 'Rate App (Default)', 'In-app review (no blur). Conversion only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('rate_app_stars', 'Rate App (Stars)', 'Star rating with title, 5 stars box, Continue. Optional feedback modal for 1–3 stars.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('tracking_permission', 'Tracking Permission', 'ATT mockup (Allow / Ask App Not to Track).', ARRAY['conversion']::text[], '{}'::jsonb),
  ('profile_image', 'Profile Image', 'Profile photo picker (skippable).', ARRAY['conversion']::text[], '{}'::jsonb),
  ('name_input', 'Name Input', 'Text input for name.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('username_input', 'Username Input', 'Text input for username.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('age_input', 'Age Input', 'Age number pad (14–120).', ARRAY['conversion']::text[], '{}'::jsonb),
  ('gender', 'Gender', 'Legacy gender key; prefer gender_select. Conversion only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('gender_select', 'Gender Select', 'Gender selection screen. Conversion funnel only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('country_select', 'Country Select', 'Country selection screen. Conversion funnel only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('push_notification_permission', 'Push Notification Permission', 'Push permission; options jsonb: template_source, notification_type (when template), mockup_type, display_name, profile_image_url, title, body, demo_user_id.', ARRAY['conversion']::text[], '{"template_source":"custom","mockup_type":"user-avatar","display_name":"","profile_image_url":"","title":"You''ve caught someone''s eye 👀","body":"{name} wants to connect!"}'::jsonb),
  ('options', 'Options (Radio Group)', 'Radio buttons; selection required before proceeding.', ARRAY['quiz', 'conversion']::text[], '{"options":[]}'::jsonb),
  ('instant_radio', 'Instant Radio (Social Icons)', 'Icon-based selection; auto-advances on select.', ARRAY['quiz', 'conversion']::text[], '{"options":[]}'::jsonb),
  ('loading', 'Loading', 'Progress/loading with auto-advance.', ARRAY['quiz', 'conversion']::text[], '{}'::jsonb),
  ('frequency_slider', 'Frequency Slider', 'Slider "How often?" (1x–5x).', ARRAY['quiz', 'conversion']::text[], '{}'::jsonb),
  ('satisfaction_slider', 'Satisfaction Slider', 'Satisfaction slider with emojis.', ARRAY['quiz', 'conversion']::text[], '{}'::jsonb),
  ('testimonial_loader', 'Testimonial Loader', 'Auto-advancing testimonials.', ARRAY['quiz', 'conversion']::text[], '{}'::jsonb),
  ('info', 'Info', 'Fallback: title + description + Next.', ARRAY['quiz', 'conversion']::text[], '{}'::jsonb),
  ('scratchdates_preview', 'ScratchDates Preview', 'Scratch-off card to preview a position from ScratchDates. Options: image_url (required), title (optional).', ARRAY['quiz', 'conversion']::text[], '{"image_url": "", "title": ""}'::jsonb)
) AS v(component_key, component_name, description, categories, default_options)
WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_components c WHERE c.component_key = v.component_key);

-- Update categories for existing rows so DB stays source of truth (if table has updated_at, it may need to be in the SET)
UPDATE public.onboarding_components c SET
  component_name = v.component_name,
  description = v.description,
  categories = v.categories,
  default_options = v.default_options
FROM (VALUES
  ('rate_app', 'Rate App', 'Triggers Store Review prompt. Quiz only.', ARRAY['quiz']::text[], '{}'::jsonb),
  ('age_input_picker', 'Age Input (Picker)', 'Native age picker (14–120). Conversion only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('age_input_scroll', 'Age Input (Scroll)', 'Scrollable age picker (12–120).', ARRAY['conversion']::text[], '{}'::jsonb),
  ('quiz_results', 'Quiz Results', 'Two-bar chart. Conversion only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('rate_app_blurred', 'Rate App (Blurred)', 'In-app review with blur. Conversion only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('rate_app_default', 'Rate App (Default)', 'In-app review (no blur). Conversion only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('rate_app_stars', 'Rate App (Stars)', 'Star rating with title, 5 stars box, Continue. Optional feedback modal for 1–3 stars.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('tracking_permission', 'Tracking Permission', 'ATT mockup (Allow / Ask App Not to Track).', ARRAY['conversion']::text[], '{}'::jsonb),
  ('profile_image', 'Profile Image', 'Profile photo picker (skippable).', ARRAY['conversion']::text[], '{}'::jsonb),
  ('name_input', 'Name Input', 'Text input for name.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('username_input', 'Username Input', 'Text input for username.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('age_input', 'Age Input', 'Age number pad (14–120).', ARRAY['conversion']::text[], '{}'::jsonb),
  ('gender', 'Gender', 'Legacy gender key; prefer gender_select. Conversion only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('gender_select', 'Gender Select', 'Gender selection screen. Conversion funnel only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('country_select', 'Country Select', 'Country selection screen. Conversion funnel only.', ARRAY['conversion']::text[], '{}'::jsonb),
  ('push_notification_permission', 'Push Notification Permission', 'Push permission; options jsonb: template_source, notification_type (when template), mockup_type, display_name, profile_image_url, title, body, demo_user_id.', ARRAY['conversion']::text[], '{"template_source":"custom","mockup_type":"user-avatar","display_name":"","profile_image_url":"","title":"You''ve caught someone''s eye 👀","body":"{name} wants to connect!"}'::jsonb),
  ('options', 'Options (Radio Group)', 'Radio buttons; selection required before proceeding.', ARRAY['quiz', 'conversion']::text[], '{"options":[]}'::jsonb),
  ('instant_radio', 'Instant Radio (Social Icons)', 'Icon-based selection; auto-advances on select.', ARRAY['quiz', 'conversion']::text[], '{"options":[]}'::jsonb),
  ('loading', 'Loading', 'Progress/loading with auto-advance.', ARRAY['quiz', 'conversion']::text[], '{}'::jsonb),
  ('frequency_slider', 'Frequency Slider', 'Slider "How often?" (1x–5x).', ARRAY['quiz', 'conversion']::text[], '{}'::jsonb),
  ('satisfaction_slider', 'Satisfaction Slider', 'Satisfaction slider with emojis.', ARRAY['quiz', 'conversion']::text[], '{}'::jsonb),
  ('testimonial_loader', 'Testimonial Loader', 'Auto-advancing testimonials.', ARRAY['quiz', 'conversion']::text[], '{}'::jsonb),
  ('info', 'Info', 'Fallback: title + description + Next.', ARRAY['quiz', 'conversion']::text[], '{}'::jsonb),
  ('scratchdates_preview', 'ScratchDates Preview', 'Scratch-off card to preview a position from ScratchDates. Options: image_url (required), title (optional).', ARRAY['quiz', 'conversion']::text[], '{"image_url": "", "title": ""}'::jsonb)
) AS v(component_key, component_name, description, categories, default_options)
WHERE c.component_key = v.component_key;

-- push_notification_permission must not be tagged for the quiz funnel (saves hit quiz-screens validation).
UPDATE public.onboarding_components
SET categories = ARRAY['conversion']::text[]
WHERE component_key = 'push_notification_permission';

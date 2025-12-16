-- Insert onboarding components into the component registry
-- This populates the onboarding_components table with all available components from the mobile app

INSERT INTO public.onboarding_components (component_key, component_name, category, description, props_schema, default_options)
VALUES 
  (
    'loading',
    'Loading Screen',
    'quiz',
    'Animated loading screen with progress bar and step text. Automatically navigates to next screen when complete.',
    '{"title": {"type": "string", "required": false}, "description": {"type": "string", "required": false}, "options": {}}'::jsonb,
    '{}'::jsonb
  ),
  (
    'options',
    'Options (Radio Group)',
    'quiz',
    'Standard radio button group allowing users to select one option from a list. Selection is required before proceeding.',
    '{"title": {"type": "string", "required": true}, "description": {"type": "string", "required": false}, "options": {"options": {"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}, "label": {"type": "string"}, "value": {"type": "string"}}, "required": ["label", "value"]}, "default": []}}}'::jsonb,
    '{"options": []}'::jsonb
  ),
  (
    'instant_radio',
    'Instant Radio (Social Icons)',
    'quiz',
    'Radio button group with input-style variant and automatic icon detection based on option value/id. Automatically proceeds on selection.',
    '{"title": {"type": "string", "required": true}, "description": {"type": "string", "required": false}, "options": {"options": {"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}, "label": {"type": "string"}, "value": {"type": "string"}}, "required": ["label", "value"]}, "default": []}}}'::jsonb,
    '{"options": []}'::jsonb
  ),
  (
    'name_input',
    'Name Input',
    'quiz',
    'Text input field for collecting user''s name. Validates minimum 2 characters. Saves to user profile.',
    '{"title": {"type": "string", "required": true}, "description": {"type": "string", "required": false}, "options": {"placeholder": {"type": "string", "default": "Enter your name"}, "minLength": {"type": "number", "default": 2}}}'::jsonb,
    '{"placeholder": "Enter your name", "minLength": 2}'::jsonb
  ),
  (
    'username_input',
    'Username Input',
    'quiz',
    'Text input field for collecting username. Validates minimum 3 characters, alphanumeric + underscore only. Checks availability and saves to profile.',
    '{"title": {"type": "string", "required": true}, "description": {"type": "string", "required": false}, "options": {"placeholder": {"type": "string", "default": "Enter your username"}, "minLength": {"type": "number", "default": 3}, "pattern": {"type": "string", "default": "^[a-zA-Z0-9_]+$"}}}'::jsonb,
    '{"placeholder": "Enter your username", "minLength": 3, "pattern": "^[a-zA-Z0-9_]+$"}'::jsonb
  ),
  (
    'age_input',
    'Age Input',
    'quiz',
    'Numeric input field for collecting user''s age. Validates age between 18 and 120. Saves to user profile.',
    '{"title": {"type": "string", "required": true}, "description": {"type": "string", "required": false}, "options": {"placeholder": {"type": "string", "default": "Enter your age"}, "min": {"type": "number", "default": 18}, "max": {"type": "number", "default": 120}}}'::jsonb,
    '{"placeholder": "Enter your age", "min": 18, "max": 120}'::jsonb
  ),
  (
    'profile_image',
    'Profile Image Upload',
    'quiz',
    'Image picker component for uploading profile photo. Opens device photo library, allows cropping. Saves to user profile. Can be skipped.',
    '{"title": {"type": "string", "required": true}, "description": {"type": "string", "required": false}, "options": {"aspectRatio": {"type": "array", "default": [1, 1]}, "quality": {"type": "number", "default": 0.8}, "allowsEditing": {"type": "boolean", "default": true}, "skipable": {"type": "boolean", "default": true}}}'::jsonb,
    '{"aspectRatio": [1, 1], "quality": 0.8, "allowsEditing": true, "skipable": true}'::jsonb
  ),
  (
    'frequency_slider',
    'Frequency Slider',
    'quiz',
    'Discrete slider component for selecting frequency (1x-5x). Shows step labels and current value.',
    '{"title": {"type": "string", "required": true}, "description": {"type": "string", "required": false}, "options": {"min": {"type": "number", "default": 1}, "max": {"type": "number", "default": 5}, "stepLabels": {"type": "array", "items": {"type": "string"}, "default": ["1x", "2x", "3x", "4x", "5x"]}}}'::jsonb,
    '{"min": 1, "max": 5, "stepLabels": ["1x", "2x", "3x", "4x", "5x"]}'::jsonb
  ),
  (
    'satisfaction_slider',
    'Satisfaction Slider',
    'quiz',
    'Discrete slider component for rating satisfaction (1-5). Shows emoji markers and satisfaction labels.',
    '{"title": {"type": "string", "required": true}, "description": {"type": "string", "required": false}, "options": {"min": {"type": "number", "default": 1}, "max": {"type": "number", "default": 5}, "stepLabels": {"type": "array", "items": {"type": "string"}, "default": ["Awful", "Not great", "Okay", "Good", "Amazing"]}, "markerLabels": {"type": "array", "items": {"type": "string"}, "default": ["😡", "😕", "😐", "🙂", "🤩"]}, "showRangeLabels": {"type": "boolean", "default": false}}}'::jsonb,
    '{"min": 1, "max": 5, "stepLabels": ["Awful", "Not great", "Okay", "Good", "Amazing"], "markerLabels": ["😡", "😕", "😐", "🙂", "🤩"], "showRangeLabels": false}'::jsonb
  ),
  (
    'testimonial_loader',
    'Testimonial Loader',
    'quiz',
    'Animated loading component that displays rotating testimonials/reviews from users. Shows circular progress indicator. Auto-advances when complete.',
    '{"title": {"type": "string", "required": false}, "description": {"type": "string", "required": false}, "options": {"duration": {"type": "number", "default": 6000}, "carouselInterval": {"type": "number", "default": 1500}}}'::jsonb,
    '{"duration": 6000, "carouselInterval": 1500}'::jsonb
  ),
  (
    'info',
    'Info Screen',
    'quiz',
    'Simple information screen displaying only title and description with a Next button. No interactive components.',
    '{"title": {"type": "string", "required": true}, "description": {"type": "string", "required": true}, "options": {}}'::jsonb,
    '{}'::jsonb
  ),
  (
    'quiz_results',
    'Quiz Results Chart',
    'conversion',
    'Displays a comparison chart showing current vs potential improvement using bar charts. Shows percentage improvement.',
    '{"title": {"type": "string", "required": true}, "description": {"type": "string", "required": false}, "options": {}}'::jsonb,
    '{}'::jsonb
  ),
  (
    'rate_app_blurred',
    'Rate App (Blurred)',
    'conversion',
    'App store rating prompt screen with blurred background overlay and 4-second countdown. Shows reviews, user avatars, and star ratings. Prompts native review dialog.',
    '{"title": {"type": "string", "required": true}, "description": {"type": "string", "required": false}, "options": {"countdownDuration": {"type": "number", "default": 4}, "showBlur": {"type": "boolean", "default": true}, "showReviews": {"type": "boolean", "default": true}, "showUserCount": {"type": "boolean", "default": true}}}'::jsonb,
    '{"countdownDuration": 4, "showBlur": true, "showReviews": true, "showUserCount": true}'::jsonb
  ),
  (
    'rate_app_default',
    'Rate App (Default)',
    'conversion',
    'App store rating prompt screen without blur overlay. Shows reviews, user avatars, and star ratings. Prompts native review dialog immediately. Always shows Next button.',
    '{"title": {"type": "string", "required": true}, "description": {"type": "string", "required": false}, "options": {"showBlur": {"type": "boolean", "default": false}, "showReviews": {"type": "boolean", "default": true}, "showUserCount": {"type": "boolean", "default": true}}}'::jsonb,
    '{"showBlur": false, "showReviews": true, "showUserCount": true}'::jsonb
  )
ON CONFLICT (component_key) DO UPDATE
SET
  component_name = EXCLUDED.component_name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  props_schema = EXCLUDED.props_schema,
  default_options = EXCLUDED.default_options,
  updated_at = timezone('utc'::text, now());


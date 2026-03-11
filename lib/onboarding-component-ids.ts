/**
 * Allowed component_id values by onboarding table.
 * Synced with mobile app: quiz (app/onboarding), conversion (app/conversion).
 * @see docs/ONBOARDING_SCREENS_REFERENCE.md in Shameless mobile repo
 */

/** Quiz-only: not supported in conversion screens */
export const QUIZ_ONLY = ['rate_app'] as const

/** Conversion-only: require auth / post-auth (not shown in quiz "Select Component") */
export const CONVERSION_ONLY = [
  'age_input_picker',
  'age_input_scroll',
  'quiz_results',
  'rate_app_blurred',
  'rate_app_default',
  'rate_app_stars',
  'tracking_permission',
  'profile_image',
  'name_input',
  'username_input',
  'age_input',
  'gender',
  'push_notification_permission',
] as const

/** Supported in both quiz and conversion (pre-auth safe for quiz) */
export const SHARED = [
  'options',
  'instant_radio',
  'loading',
  'frequency_slider',
  'satisfaction_slider',
  'testimonial_loader',
  'info',
  'scratchdates_preview',
] as const

export const QUIZ_COMPONENT_IDS: readonly string[] = [...SHARED, ...QUIZ_ONLY]
export const CONVERSION_COMPONENT_IDS: readonly string[] = [...SHARED, ...CONVERSION_ONLY]

export function isAllowedQuizComponent(componentId: string | null): boolean {
  if (!componentId) return true
  return QUIZ_COMPONENT_IDS.includes(componentId)
}

export function isAllowedConversionComponent(componentId: string | null): boolean {
  if (!componentId) return true
  return CONVERSION_COMPONENT_IDS.includes(componentId)
}

/** Display names for component_ids (used when not in onboarding_components DB) */
export const COMPONENT_DISPLAY: Record<
  string,
  { component_name: string; description: string }
> = {
  options: { component_name: 'Options (Radio Group)', description: 'Radio buttons; selection required before proceeding.' },
  instant_radio: { component_name: 'Instant Radio (Social Icons)', description: 'Icon-based selection; auto-advances on select.' },
  loading: { component_name: 'Loading', description: 'Progress/loading with auto-advance.' },
  name_input: { component_name: 'Name Input', description: 'Text input for name.' },
  username_input: { component_name: 'Username Input', description: 'Text input for username.' },
  age_input: { component_name: 'Age Input', description: 'Age number pad (14–120).' },
  age_input_scroll: { component_name: 'Age Input (Scroll)', description: 'Scrollable age picker (12–120).' },
  age_input_picker: { component_name: 'Age Input (Picker)', description: 'Native age picker (14–120). Conversion only.' },
  profile_image: { component_name: 'Profile Image', description: 'Profile photo picker (skippable).' },
  frequency_slider: { component_name: 'Frequency Slider', description: 'Slider "How often?" (1x–5x).' },
  satisfaction_slider: { component_name: 'Satisfaction Slider', description: 'Satisfaction slider with emojis.' },
  testimonial_loader: { component_name: 'Testimonial Loader', description: 'Auto-advancing testimonials.' },
  rate_app: { component_name: 'Rate App', description: 'Triggers Store Review prompt. Quiz only.' },
  rate_app_blurred: { component_name: 'Rate App (Blurred)', description: 'In-app review with blur. Conversion only.' },
  rate_app_default: { component_name: 'Rate App (Default)', description: 'In-app review (no blur). Conversion only.' },
  rate_app_stars: { component_name: 'Rate App (Stars)', description: 'Star rating with title, 5 stars box, Continue. Optional feedback modal for 1–3 stars.' },
  push_notification_permission: { component_name: 'Push Notification Permission', description: 'Push permission (simplified in quiz, full in conversion).' },
  tracking_permission: { component_name: 'Tracking Permission', description: 'ATT mockup (Allow / Ask App Not to Track).' },
  quiz_results: { component_name: 'Quiz Results', description: 'Two-bar chart. Conversion only.' },
  gender: { component_name: 'Gender', description: 'Gender selection. Conversion only.' },
  info: { component_name: 'Info', description: 'Fallback: title + description + Next.' },
  scratchdates_preview: { component_name: 'ScratchDates Preview', description: 'Scratch-off card to preview a position from ScratchDates. Options: image_url (required), title (optional).' },
}

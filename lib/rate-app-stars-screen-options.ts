/**
 * rate_app_stars conversion screen — options JSONB (object only).
 * Controls low-rating (1–3★) feedback modal: Skip visibility and empty Send behavior.
 * Mirrors mobile utils/rateAppStarsScreenOptions + RateAppStarsScreenOptions.
 */

/** If both skip flags are set, hide_skip_button: true wins for hiding Skip. */
export function parseRateAppStarsShowSkipButton(options: unknown): boolean {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return true
  const o = options as Record<string, unknown>
  if (o.hide_skip_button === true) return false
  if (o.show_skip_button === false) return false
  return true
}

/**
 * When true, empty Send Feedback shows alert and stays on modal (default).
 * allow_empty_feedback_submit: true → same as require_feedback_text: false.
 */
export function parseRateAppStarsRequireFeedbackText(options: unknown): boolean {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return true
  const o = options as Record<string, unknown>
  if (o.allow_empty_feedback_submit === true) return false
  if (o.require_feedback_text === false) return false
  if (o.require_feedback_text === true) return true
  return true
}

/** Writes canonical keys: hide_skip_button when skip hidden; allow_empty_feedback_submit when text not required. */
export function serializeRateAppStarsScreenOptions(
  showSkip: boolean,
  requireFeedbackText: boolean,
  currentOptionsJson: string
): string {
  let o: Record<string, unknown> = {}
  try {
    const p = currentOptionsJson.trim() ? JSON.parse(currentOptionsJson) : {}
    if (p && typeof p === 'object' && !Array.isArray(p)) o = { ...p }
  } catch {
    o = {}
  }

  delete o.show_skip_button
  delete o.hide_skip_button
  delete o.require_feedback_text
  delete o.allow_empty_feedback_submit

  if (!showSkip) {
    o.hide_skip_button = true
  }
  if (!requireFeedbackText) {
    o.allow_empty_feedback_submit = true
  }

  return JSON.stringify(o, null, 2)
}

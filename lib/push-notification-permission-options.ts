/**
 * CMS + API validation for onboarding component_id: push_notification_permission.
 * Mobile: full mockup on conversion_screens*; quiz uses simple title + Next (options stored for consistency).
 * @see mobile app conversion/[id].tsx — options must be a single JSON object, never a top-level array.
 */

export const PUSH_NEXT_CTA_DELAY_CHOICES = ['instant', '1s', '2s', '3s'] as const
export type PushNextCtaDelayChoice = (typeof PUSH_NEXT_CTA_DELAY_CHOICES)[number]

/** Map stored app values to the CMS enum (undocumented literals → safe default 3s). */
export function coerceNextCtaDelayToChoice(v: unknown): PushNextCtaDelayChoice {
  if (v === 'instant' || v === 'none' || v === 0 || v === '0' || v === '0s') return 'instant'
  if (v === '1s' || v === 1000 || v === '1000') return '1s'
  if (v === '2s' || v === 2000 || v === '2000') return '2s'
  if (v === '3s' || v === 3000 || v === '3000') return '3s'
  return '3s'
}

export function isPushNextCtaDelayChoice(v: unknown): v is PushNextCtaDelayChoice {
  return (
    typeof v === 'string' &&
    (PUSH_NEXT_CTA_DELAY_CHOICES as readonly string[]).includes(v)
  )
}

export function validatePushNotificationPermissionOptions(
  options: unknown
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (options == null || options === '') {
    return { ok: true, value: {} }
  }
  if (Array.isArray(options)) {
    return {
      ok: false,
      error: 'push_notification_permission options must be a JSON object, not a top-level array.',
    }
  }
  if (typeof options !== 'object') {
    return {
      ok: false,
      error: 'push_notification_permission options must be a JSON object.',
    }
  }
  return { ok: true, value: { ...(options as Record<string, unknown>) } }
}

/** Human-readable line for CMS / preview tooltips. */
export function describeNextCtaDelayChoice(choice: PushNextCtaDelayChoice): string {
  switch (choice) {
    case 'instant':
      return 'Next shows immediately (no delay).'
    case '1s':
      return 'Next stays hidden for ~1s after open (e.g. OS permission prompt first).'
    case '2s':
      return 'Next stays hidden for ~2s after open.'
    case '3s':
      return 'Next stays hidden for ~3s after open (app default when omitted).'
  }
}

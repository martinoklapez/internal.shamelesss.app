/**
 * Profile image step — testimonial marquee URLs + visibility flags from options JSONB.
 * Mirrors mobile utils/profileImageTestimonialAvatars / ProfileImageScreenOptions (conversion).
 */

export const PROFILE_IMAGE_TESTIMONIAL_MAX_URLS = 8

const HTTP_URL = /^https?:\/\//i

/**
 * Whether the testimonial marquee strip is shown.
 * Precedence: explicit `show_testimonial_marquee` boolean wins; else `hide_testimonial_marquee === true` hides;
 * else default true (omitted = show).
 */
export function parseProfileImageShowTestimonialMarquee(options: unknown): boolean {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return true
  const o = options as Record<string, unknown>
  if ('show_testimonial_marquee' in o && typeof o.show_testimonial_marquee === 'boolean') {
    return o.show_testimonial_marquee
  }
  if (typeof o.hide_testimonial_marquee === 'boolean' && o.hide_testimonial_marquee === true) {
    return false
  }
  return true
}

/** Persist marquee visibility: prefer `show_testimonial_marquee`; drop `hide_testimonial_marquee` when using show key. */
export function applyProfileImageMarqueeFlagsToOptionsObject(
  o: Record<string, unknown>,
  showMarquee: boolean
): void {
  delete o.hide_testimonial_marquee
  if (showMarquee) {
    delete o.show_testimonial_marquee
  } else {
    o.show_testimonial_marquee = false
  }
}

/** Validated URLs from testimonial_avatars ?? avatars (testimonial wins). */
export function parseProfileImageTestimonialUrls(options: unknown): string[] {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return []
  const o = options as Record<string, unknown>
  const raw = o.testimonial_avatars ?? o.avatars
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const el of raw) {
    if (typeof el !== 'string') continue
    const u = el.trim()
    if (!u) continue
    if (!HTTP_URL.test(u)) continue
    out.push(u)
    if (out.length >= PROFILE_IMAGE_TESTIMONIAL_MAX_URLS) break
  }
  return out
}

/** Fallback: avatar_url from final_reviews entries (same URL rules, same cap). */
export function parseProfileImageFinalReviewAvatarUrls(options: unknown): string[] {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return []
  const arr = (options as { final_reviews?: unknown[] }).final_reviews
  if (!Array.isArray(arr)) return []
  const out: string[] = []
  for (const r of arr) {
    if (!r || typeof r !== 'object') continue
    const row = r as Record<string, unknown>
    const rawUrl = row.avatar_url
    const u = typeof rawUrl === 'string' ? rawUrl.trim() : ''
    if (!u || !HTTP_URL.test(u)) continue
    out.push(u)
    if (out.length >= PROFILE_IMAGE_TESTIMONIAL_MAX_URLS) break
  }
  return out
}

/** Raw string rows for the admin editor (preserves invalid entries so user can fix). */
export function getProfileImageEditorUrlRowsFromOptionsJson(optionsJson: string): string[] {
  let parsed: unknown = {}
  try {
    parsed = optionsJson.trim() ? JSON.parse(optionsJson) : {}
  } catch {
    return ['']
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return ['']
  const raw = (parsed as Record<string, unknown>).testimonial_avatars ?? (parsed as Record<string, unknown>).avatars
  if (!Array.isArray(raw)) return ['']
  const strings = raw.filter((x): x is string => typeof x === 'string').map((s) => s)
  return strings.length ? strings.slice(0, 24) : ['']
}

/** Merge validated testimonial_avatars into existing options object (drops avatars alias on write). */
export function serializeProfileImageOptionsWithTestimonialUrls(
  urlRows: string[],
  currentOptionsJson: string
): string {
  let o: Record<string, unknown> = {}
  try {
    const p = currentOptionsJson.trim() ? JSON.parse(currentOptionsJson) : {}
    if (p && typeof p === 'object' && !Array.isArray(p)) o = { ...p }
  } catch {
    o = {}
  }
  delete o.testimonial_avatars
  delete o.avatars
  const valid = parseProfileImageTestimonialUrls({ testimonial_avatars: urlRows })
  if (valid.length > 0) o.testimonial_avatars = valid
  return JSON.stringify(o, null, 2)
}

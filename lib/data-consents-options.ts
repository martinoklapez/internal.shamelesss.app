/**
 * data_consents conversion screen: options JSONB is a single object
 * { consents: [...], accept_all_label?, next_button_label? } — not a top-level array.
 * @see mobile ConversionScreensProvider / data consents screen
 */

export type DataConsentEditorRow = {
  id: string
  title: string
  description: string
  required: boolean
  learnMoreLabel: string
  learnMoreUrl: string
}

export function emptyDataConsentRow(): DataConsentEditorRow {
  return {
    id: '',
    title: '',
    description: '',
    required: true,
    learnMoreLabel: 'Learn more',
    learnMoreUrl: '',
  }
}

export function defaultDataConsentsOptionsObject(): Record<string, unknown> {
  return {
    consents: [
      {
        id: 'privacy',
        title: 'Privacy & data use',
        description: 'Plain text body under the title.',
        required: true,
        learn_more: { label: 'Learn more', url: 'https://example.com/privacy' },
      },
    ],
    accept_all_label: 'Accept All',
    next_button_label: 'Next',
  }
}

function rawConsentsArray(parsed: Record<string, unknown>): unknown[] {
  const c = parsed.consents ?? parsed.items
  return Array.isArray(c) ? c : []
}

export function parseDataConsentsOptionsJson(optionsJson: string): {
  rows: DataConsentEditorRow[]
  acceptAllLabel: string
  nextButtonLabel: string
} {
  let parsed: unknown = {}
  try {
    parsed = optionsJson.trim() ? JSON.parse(optionsJson) : {}
  } catch {
    parsed = {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      rows: [],
      acceptAllLabel: 'Accept All',
      nextButtonLabel: 'Next',
    }
  }
  const o = parsed as Record<string, unknown>
  const list = rawConsentsArray(o)
  const rows: DataConsentEditorRow[] = list.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return emptyDataConsentRow()
    }
    const row = item as Record<string, unknown>
    const id =
      typeof row.id === 'string'
        ? row.id
        : typeof row.key === 'string'
          ? row.key
          : ''
    const title = typeof row.title === 'string' ? row.title : ''
    const description = typeof row.description === 'string' ? row.description : ''
    const required = row.required === false ? false : true
    let learnMoreLabel = 'Learn more'
    let learnMoreUrl = ''
    const lm = row.learn_more
    if (lm && typeof lm === 'object' && !Array.isArray(lm)) {
      const l = lm as Record<string, unknown>
      if (typeof l.url === 'string' && l.url.trim()) {
        learnMoreUrl = l.url.trim()
        if (typeof l.label === 'string' && l.label.trim()) learnMoreLabel = l.label.trim()
      }
    }
    return {
      id: id || `consent_${index}`,
      title,
      description,
      required,
      learnMoreLabel,
      learnMoreUrl,
    }
  })
  const acceptAllLabel =
    typeof o.accept_all_label === 'string' && o.accept_all_label.trim()
      ? o.accept_all_label.trim()
      : 'Accept All'
  const nextButtonLabel =
    typeof o.next_button_label === 'string' && o.next_button_label.trim()
      ? o.next_button_label.trim()
      : 'Next'
  return { rows, acceptAllLabel, nextButtonLabel }
}

export function serializeDataConsentsOptions(
  rows: DataConsentEditorRow[],
  acceptAllLabel: string,
  nextButtonLabel: string
): string {
  const consents = rows
    .map((r, i) => {
      const title = r.title.trim()
      if (!title) return null
      const id = (r.id || '').trim() || `consent_${i}`
      const entry: Record<string, unknown> = {
        id,
        title,
      }
      if (r.description.trim()) entry.description = r.description.trim()
      if (r.required === false) entry.required = false
      const url = r.learnMoreUrl.trim()
      if (url) {
        entry.learn_more = {
          label: r.learnMoreLabel.trim() || 'Learn more',
          url,
        }
      }
      return entry
    })
    .filter(Boolean) as Record<string, unknown>[]
  const out: Record<string, unknown> = {
    consents,
    accept_all_label: acceptAllLabel.trim() || 'Accept All',
    next_button_label: nextButtonLabel.trim() || 'Next',
  }
  return JSON.stringify(out, null, 2)
}

export type DataConsentDisplayItem = {
  id: string
  title: string
  description?: string
  required: boolean
  learn_more?: { label?: string; url: string }
}

/** Parser for preview + mobile-shaped options on screen.options */
export function getDataConsentsDisplayModel(options: unknown): {
  consents: DataConsentDisplayItem[]
  acceptAllLabel: string
  nextButtonLabel: string
} {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return { consents: [], acceptAllLabel: 'Accept All', nextButtonLabel: 'Next' }
  }
  const o = options as Record<string, unknown>
  const list = rawConsentsArray(o)
  const consents: DataConsentDisplayItem[] = list
    .map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const row = item as Record<string, unknown>
      const title = typeof row.title === 'string' ? row.title.trim() : ''
      if (!title) return null
      const id =
        typeof row.id === 'string' && row.id.trim()
          ? row.id.trim()
          : typeof row.key === 'string' && row.key.trim()
            ? row.key.trim()
            : `consent_${index}`
      const description = typeof row.description === 'string' ? row.description : undefined
      const required = row.required === false ? false : true
      let learn_more: { label?: string; url: string } | undefined
      const lm = row.learn_more
      if (lm && typeof lm === 'object' && !Array.isArray(lm)) {
        const l = lm as Record<string, unknown>
        if (typeof l.url === 'string' && l.url.trim()) {
          learn_more = {
            url: l.url.trim(),
            ...(typeof l.label === 'string' && l.label.trim() ? { label: l.label.trim() } : {}),
          }
        }
      }
      return { id, title, description, required, learn_more }
    })
    .filter(Boolean) as DataConsentDisplayItem[]
  const acceptAllLabel =
    typeof o.accept_all_label === 'string' && o.accept_all_label.trim()
      ? o.accept_all_label.trim()
      : 'Accept All'
  const nextButtonLabel =
    typeof o.next_button_label === 'string' && o.next_button_label.trim()
      ? o.next_button_label.trim()
      : 'Next'
  return { consents, acceptAllLabel, nextButtonLabel }
}

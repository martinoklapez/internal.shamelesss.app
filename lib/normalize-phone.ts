import {
  parsePhoneNumberFromString,
  type CountryCode,
  type PhoneNumber,
} from 'libphonenumber-js'

/** Used when the user omits a country calling code (e.g. `(415) 555-2671`). */
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'US'

function parsePhone(raw: string, defaultCountry: CountryCode): PhoneNumber | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry)
  return parsed?.isValid() ? parsed : undefined
}

/** Canonical storage format: E.164 (`+14155552671`). Empty string when cleared or invalid. */
export function normalizePhone(
  raw: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY
): string {
  return parsePhone(raw, defaultCountry)?.format('E.164') ?? ''
}

export function isValidPhoneInput(
  raw: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY
): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return true
  return parsePhone(trimmed, defaultCountry) !== undefined
}

/** Human-readable display; falls back to stored value if parsing fails. */
export function formatPhoneForDisplay(
  e164: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY
): string {
  const trimmed = e164.trim()
  if (!trimmed) return ''
  const parsed =
    parsePhoneNumberFromString(trimmed) ??
    parsePhoneNumberFromString(trimmed, defaultCountry)
  if (parsed?.isValid()) return parsed.formatInternational()
  return trimmed
}

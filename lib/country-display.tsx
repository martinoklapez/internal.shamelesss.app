import { cn } from '@/lib/utils'

const REGIONAL_INDICATOR_A = 0x1f1e6

export function isoAlpha2ToFlagEmoji(alpha2: string): string | null {
  const a = alpha2.trim().toUpperCase()
  if (a.length !== 2 || !/^[A-Z]{2}$/.test(a)) return null
  try {
    return String.fromCodePoint(
      REGIONAL_INDICATOR_A + (a.charCodeAt(0) - 65),
      REGIONAL_INDICATOR_A + (a.charCodeAt(1) - 65),
    )
  } catch {
    return null
  }
}

export function getRegionDisplayName(alpha2: string, locale = 'en'): string {
  const code = alpha2.trim().toUpperCase()
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return alpha2.trim()
  try {
    const dn = new Intl.DisplayNames([locale], { type: 'region' })
    const name = dn.of(code)
    return typeof name === 'string' ? name : code
  } catch {
    return code
  }
}

export function ProfileCountryDisplay({
  code,
  className,
}: {
  code: string | null | undefined
  className?: string
}) {
  if (code === null || code === undefined || !String(code).trim()) {
    return <span className={cn('text-gray-600', className)}>—</span>
  }

  const raw = String(code).trim()
  const iso = raw.toUpperCase()
  const isIso2 = iso.length === 2 && /^[A-Z]{2}$/.test(iso)

  if (!isIso2) {
    return (
      <span className={cn('text-gray-700', className)} title={raw}>
        {raw}
      </span>
    )
  }

  const flag = isoAlpha2ToFlagEmoji(iso)
  const name = getRegionDisplayName(iso)

  return (
    <span
      className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-900', className)}
      title={`${name} (${iso})`}
    >
      {flag !== null ? (
        <span className="text-lg leading-none" aria-hidden>
          {flag}
        </span>
      ) : null}
      <span className="leading-snug">{name}</span>
      <span className="text-xs text-gray-500 tabular-nums">({iso})</span>
    </span>
  )
}

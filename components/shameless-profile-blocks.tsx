'use client'

import { Smartphone, Share2, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { getCountryName, getFlagEmoji } from '@/lib/countries'
import { formatDate } from '@/lib/utils/date'

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  dev: 'Dev',
  developer: 'Developer',
  promoter: 'Promoter',
  tester: 'Tester',
  demo: 'Demo',
  user: 'App user',
}

export const MODERATOR_ROLES = new Set(['admin', 'developer', 'promoter', 'dev'])

export function genderDisplay(gender: string | null | undefined) {
  const g = gender?.trim().toLowerCase()
  if (g === 'male') return { emoji: '👨', label: 'Male' }
  if (g === 'female') return { emoji: '👩', label: 'Female' }
  if (g === 'other') return { emoji: '🧑', label: 'Other' }
  return null
}

export function normalizeInstagram(handle: string | null | undefined): string | null {
  if (!handle?.trim()) return null
  const h = handle.trim()
  return h.startsWith('@') ? h : `@${h}`
}

export function normalizeSnapchat(handle: string | null | undefined): string | null {
  if (!handle?.trim()) return null
  return handle.trim().replace(/^@+/, '')
}

export function shamelessProfileHeadline(profile: {
  id: string
  name: string | null
  username: string | null
}): string {
  const name = profile.name?.trim()
  const username = profile.username?.trim()
  if (name) return name
  if (username) return `@${username}`
  return `User ${profile.id.slice(0, 8)}…`
}

export interface ShamelessProfileAvatarChromeProps {
  profile_picture_url: string | null
  name: string | null
  username: string | null
  userId: string
  age: number | null
  country_code: string | null
  connection_count: number
  /** Outer avatar diameter in px */
  sizePx?: number
  avatarUpload?: {
    onClick: () => void
    uploading: boolean
    disabled?: boolean
  }
  className?: string
}

/** Circular avatar + corner badges (Shameless app styling). */
export function ShamelessProfileAvatarChrome({
  profile_picture_url,
  name,
  username,
  userId,
  age,
  country_code,
  connection_count,
  sizePx = 140,
  avatarUpload,
  className,
}: ShamelessProfileAvatarChromeProps) {
  const code = country_code?.trim()
  const flag = code ? getFlagEmoji(code) || '🌎' : '🌎'

  const avatarLetter = (
    name?.trim()?.[0] ||
    username?.trim()?.[0] ||
    userId[0] ||
    '?'
  ).toUpperCase()

  const connections = connection_count ?? 0

  const circle = (
    <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-black bg-[#EEEEEE] shadow-[0_4px_0_0_#000]">
      {profile_picture_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- external storage URL
        <img src={profile_picture_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-black text-[#94A3B8]"
          style={{ fontSize: Math.round(sizePx * 0.28) }}
        >
          {avatarLetter}
        </div>
      )}
      {avatarUpload?.uploading === true ? (
        <span className="absolute inset-0 z-[5] flex items-center justify-center rounded-full bg-black/50 text-xs font-medium text-white">
          …
        </span>
      ) : null}
    </div>
  )

  const avatarBody = avatarUpload ? (
    <button
      type="button"
      onClick={avatarUpload.onClick}
      disabled={avatarUpload.disabled || avatarUpload.uploading}
      title="Upload photo"
      className={cn(
        'relative block h-full w-full shrink-0 rounded-full p-0 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50'
      )}
    >
      {circle}
    </button>
  ) : (
    <div className="relative h-full w-full shrink-0">{circle}</div>
  )

  return (
    <div
      className={cn('relative mx-auto shrink-0 sm:mx-0', className)}
      style={{ width: sizePx, height: sizePx }}
    >
      {avatarBody}

      <div className="pointer-events-none absolute -left-1 -top-1 z-10 flex h-9 min-w-[2.25rem] items-center justify-center rounded-full border-2 border-black bg-white px-2 text-lg leading-none shadow-[0_2px_0_0_#000]">
        <span aria-hidden>{flag}</span>
      </div>

      {typeof age === 'number' && Number.isFinite(age) ? (
        <div className="pointer-events-none absolute -bottom-1 -left-1 z-10 flex items-center gap-0.5 rounded-full border-2 border-black bg-white px-2 py-0.5 shadow-[0_2px_0_0_#000]">
          <span aria-hidden>🎂</span>
          <span className="text-sm font-black tabular-nums leading-none">{age}</span>
        </div>
      ) : null}

      <div className="pointer-events-none absolute -bottom-1 -right-1 z-10 flex items-center gap-0.5 rounded-full border-2 border-black bg-white px-2 py-0.5 shadow-[0_2px_0_0_#000]">
        <Users className="h-3.5 w-3.5 shrink-0 text-black" aria-hidden />
        <span className="text-xs font-bold tabular-nums">{connections}</span>
      </div>
    </div>
  )
}

export interface ShamelessProfileReadOnlyDetailsProps {
  profile: {
    id: string
    name: string | null
    username: string | null
    role: string
    gender: string | null
    country_code: string | null
    instagram_handle: string | null
    snapchat_handle: string | null
    connection_count: number
    age: number | null
    email: string | null
    created_at: string | null
  }
  sourceLabel?: string | null
  showRoleChip?: boolean
  showAdminMeta?: boolean
  className?: string
}

/** Right-column profile copy (Shameless typography + social panel). */
export function ShamelessProfileReadOnlyDetails({
  profile,
  sourceLabel,
  showRoleChip = true,
  showAdminMeta = true,
  className,
}: ShamelessProfileReadOnlyDetailsProps) {
  const username = profile.username?.trim()
  const showUsernameSecondLine = Boolean(profile.name?.trim() && username)

  const code = profile.country_code?.trim()
  const flag = code ? getFlagEmoji(code) || '🌎' : '🌎'
  const countryName = code ? getCountryName(code) : ''
  const countryPrimaryLine = countryName ? `${flag} ${countryName}` : flag

  const genderInfo = genderDisplay(profile.gender)
  const ig = normalizeInstagram(profile.instagram_handle)
  const snap = normalizeSnapchat(profile.snapchat_handle)

  const roleLabel = ROLE_LABELS[profile.role] ?? profile.role

  return (
    <div className={cn('min-w-0 flex-1 space-y-3 pt-1', className)}>
      <div>
        <h2
          className="font-black tracking-tight text-black [-webkit-font-smoothing:antialiased]"
          style={{
            fontSize: 24,
            letterSpacing: '-0.5px',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          {shamelessProfileHeadline(profile)}
        </h2>
        {showUsernameSecondLine && username ? (
          <p className="mt-1 text-sm font-medium leading-none text-[#64748B]">@{username}</p>
        ) : null}
        {sourceLabel ? <p className="mt-1 text-xs font-medium text-[#94A3B8]">{sourceLabel}</p> : null}
      </div>

      {showRoleChip ? (
        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              'inline-flex rounded-full border-2 border-black px-2.5 py-0.5 text-xs font-bold',
              MODERATOR_ROLES.has(profile.role)
                ? 'bg-[#FF5252] text-white shadow-[0_2px_0_0_#000]'
                : 'bg-[#F5F5F5] text-black'
            )}
          >
            {roleLabel}
          </span>
        </div>
      ) : null}

      <div className="space-y-1 border-t border-[#F5F5F5] pt-3 text-[13px]">
        <p className="font-medium text-black">{countryPrimaryLine}</p>
        {genderInfo ? (
          <p className="text-[#64748B]">
            <span aria-hidden>{genderInfo.emoji}</span> {genderInfo.label}
          </p>
        ) : null}
      </div>

      {ig || snap ? (
        <div className="space-y-2 rounded-2xl border-2 border-black bg-[#F5F5F5] p-3">
          {ig ? (
            <div className="flex items-start gap-2 text-[13px] font-semibold text-black">
              <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-black" aria-hidden />
              <span className="min-w-0 break-all">{ig}</span>
            </div>
          ) : null}
          {snap ? (
            <div className="flex items-start gap-2 text-[13px] font-semibold text-black">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-black" aria-hidden />
              <span className="min-w-0 break-all">{snap}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {showAdminMeta ? (
        <div className="space-y-1 border-t border-[#F5F5F5] pt-3 text-[12px] text-[#94A3B8]">
          <p className="break-all font-mono text-black/70">{profile.id}</p>
          {profile.email ? <p className="break-all">{profile.email}</p> : null}
          {profile.created_at ? <p>Joined {formatDate(profile.created_at)}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

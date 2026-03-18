'use client'

import { useMemo, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils/date'
import type { FeatureFlag } from '@/lib/database/feature-flags'

interface FeatureFlagsManagerProps {
  featureFlags: FeatureFlag[]
}

type FlagGroupDef = {
  id: string
  title: string
  description: string
  /** Ordered flag_ids in this group */
  flagIds: readonly string[]
  badge?: string
  variant?: 'legacy' | 'upsell' | 'ui'
}

const FLAG_GROUPS: readonly FlagGroupDef[] = [
  {
    id: 'legacy-paywall',
    title: 'Legacy paywall',
    description:
      'Global gate: users must subscribe to use the app. Still honored on older app versions.',
    flagIds: ['force_paywall'],
    badge: 'Legacy',
    variant: 'legacy',
  },
  {
    id: 'navigation',
    title: 'Navigation',
    description: 'Which tabs appear in the main app navigation.',
    flagIds: ['chats', 'friends'],
    badge: 'UI',
    variant: 'ui',
  },
  {
    id: 'paywall-v2-onboarding',
    title: 'Onboarding & game start',
    description:
      'Block progression until subscribed after the relevant paywall (onboarding completion or starting a game).',
    flagIds: ['force_paywall_onboarding', 'force_paywall_game_start'],
    badge: 'Upsell',
    variant: 'upsell',
  },
  {
    id: 'paywall-v2-explore',
    title: 'Explore',
    description:
      'Plus entitlement required for explore flows: friend requests, accepting/rejecting, and loading more profiles.',
    flagIds: [
      'force_paywall_explore_friend_send',
      'force_paywall_explore_friend_actions',
      'force_paywall_explore_load_more',
    ],
    badge: 'Upsell',
    variant: 'upsell',
  },
  {
    id: 'paywall-v2-profile',
    title: 'Filters & profile',
    description:
      'Plus entitlement for filters, revealing social handles, and fullscreen profile photos.',
    flagIds: [
      'force_paywall_filters',
      'force_paywall_social_handle_reveal',
      'force_paywall_profile_fullscreen',
    ],
    badge: 'Upsell',
    variant: 'upsell',
  },
] as const

const ALL_GROUPED_IDS = new Set(
  FLAG_GROUPS.flatMap((g) => [...g.flagIds])
)

function groupBadgeClass(variant: FlagGroupDef['variant']) {
  switch (variant) {
    case 'legacy':
      return 'bg-amber-100 text-amber-900 border-amber-200'
    case 'upsell':
      return 'bg-violet-100 text-violet-900 border-violet-200'
    case 'ui':
      return 'bg-slate-100 text-slate-800 border-slate-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function FlagRow({
  flag,
  loading,
  onToggle,
}: {
  flag: FeatureFlag
  loading: boolean
  onToggle: (flagId: string, current: boolean) => void
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 py-5 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-sm font-semibold text-gray-900 bg-gray-50 px-1.5 py-0.5 rounded">
            {flag.flag_id}
          </code>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full shrink-0 ${
              flag.is_enabled
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {flag.is_enabled ? 'On' : 'Off'}
          </span>
        </div>
        {flag.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{flag.description}</p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-0 text-xs text-gray-400">
          <span>Updated {formatDate(flag.updated_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 sm:pt-0.5">
        <Label htmlFor={`toggle-${flag.flag_id}`} className="text-xs text-gray-500 sr-only sm:not-sr-only">
          Toggle
        </Label>
        <Switch
          id={`toggle-${flag.flag_id}`}
          checked={flag.is_enabled}
          onCheckedChange={() => onToggle(flag.flag_id, flag.is_enabled)}
          disabled={loading}
        />
      </div>
    </div>
  )
}

export default function FeatureFlagsManager({ featureFlags: initialFeatureFlags }: FeatureFlagsManagerProps) {
  const [featureFlags, setFeatureFlags] = useState(initialFeatureFlags)
  const [loadingFlagId, setLoadingFlagId] = useState<string | null>(null)

  const flagById = useMemo(() => {
    const m = new Map<string, FeatureFlag>()
    for (const f of featureFlags) m.set(f.flag_id, f)
    return m
  }, [featureFlags])

  const ungroupedFlags = useMemo(
    () => featureFlags.filter((f) => !ALL_GROUPED_IDS.has(f.flag_id)),
    [featureFlags]
  )

  const handleToggle = async (flagId: string, currentValue: boolean) => {
    setLoadingFlagId(flagId)

    try {
      const response = await fetch('/api/feature-flags/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId, isEnabled: !currentValue }),
      })

      if (!response.ok) throw new Error('Failed to toggle feature flag')

      const updatedFlag = await response.json()
      setFeatureFlags((prev) => prev.map((flag) => (flag.flag_id === flagId ? updatedFlag : flag)))
    } catch (error) {
      console.error('Error toggling feature flag:', error)
      setFeatureFlags((prev) =>
        prev.map((flag) => (flag.flag_id === flagId ? { ...flag, is_enabled: currentValue } : flag))
      )
    } finally {
      setLoadingFlagId(null)
    }
  }

  if (featureFlags.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">No feature flags found.</div>
    )
  }

  return (
    <div className="flex flex-col gap-10 sm:gap-12">
      {FLAG_GROUPS.map((group) => {
        const flagsInGroup = group.flagIds
          .map((id) => flagById.get(id))
          .filter((f): f is FeatureFlag => f != null)

        if (flagsInGroup.length === 0) return null

        return (
          <Card key={group.id} className="shadow-sm">
            <CardHeader className="space-y-0 border-b bg-gray-50/80 p-4 pb-4 sm:p-6 sm:pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-4 sm:gap-y-2">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg leading-snug">{group.title}</CardTitle>
                  <CardDescription className="mt-2 max-w-3xl text-pretty leading-relaxed">
                    {group.description}
                  </CardDescription>
                </div>
                {group.badge && (
                  <Badge
                    variant="outline"
                    className={`w-fit shrink-0 self-start sm:self-start ${groupBadgeClass(group.variant)}`}
                  >
                    {group.badge}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
              {flagsInGroup.map((flag) => (
                <FlagRow
                  key={flag.id}
                  flag={flag}
                  loading={loadingFlagId === flag.flag_id}
                  onToggle={handleToggle}
                />
              ))}
            </CardContent>
          </Card>
        )
      })}

      {ungroupedFlags.length > 0 && (
        <Card className="shadow-sm border-amber-200">
          <CardHeader className="space-y-0 border-b bg-amber-50/50 p-4 pb-4 sm:p-6 sm:pb-5">
            <CardTitle className="text-lg leading-snug">Other flags</CardTitle>
            <CardDescription className="mt-2 text-pretty leading-relaxed">
              Not yet assigned to a section — add them to the grouping in the admin code or keep them here.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
            {ungroupedFlags.map((flag) => (
              <FlagRow
                key={flag.id}
                flag={flag}
                loading={loadingFlagId === flag.flag_id}
                onToggle={handleToggle}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

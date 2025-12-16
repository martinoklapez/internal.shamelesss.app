'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { FeatureFlag } from '@/lib/database/feature-flags'

interface FeatureFlagsManagerProps {
  featureFlags: FeatureFlag[]
}

// Format date consistently to avoid hydration errors
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day}/${year}`
}

export default function FeatureFlagsManager({ featureFlags: initialFeatureFlags }: FeatureFlagsManagerProps) {
  const [featureFlags, setFeatureFlags] = useState(initialFeatureFlags)
  const [loadingFlagId, setLoadingFlagId] = useState<string | null>(null)

  const handleToggle = async (flagId: string, currentValue: boolean) => {
    setLoadingFlagId(flagId)
    
    try {
      const response = await fetch('/api/feature-flags/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flagId,
          isEnabled: !currentValue,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle feature flag')
      }

      const updatedFlag = await response.json()
      
      setFeatureFlags((prev) =>
        prev.map((flag) =>
          flag.flag_id === flagId ? updatedFlag : flag
        )
      )
    } catch (error) {
      console.error('Error toggling feature flag:', error)
      // Revert the change on error
      setFeatureFlags((prev) =>
        prev.map((flag) =>
          flag.flag_id === flagId ? { ...flag, is_enabled: currentValue } : flag
        )
      )
    } finally {
      setLoadingFlagId(null)
    }
  }

  if (featureFlags.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">
          No feature flags found.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {featureFlags.map((flag) => {
        const isLoading = loadingFlagId === flag.flag_id
        
        return (
          <div
            key={flag.id}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white break-words">
                  {flag.flag_id}
                </h3>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full shrink-0 ${
                    flag.is_enabled
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {flag.is_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {flag.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                  {flag.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2">
                <span>Created: {formatDate(flag.created_at)}</span>
                <span>Updated: {formatDate(flag.updated_at)}</span>
              </div>
            </div>
            <div className="flex items-center sm:items-center gap-3 sm:ml-4">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`toggle-${flag.flag_id}`}
                  className="w-20 text-right text-xs sm:text-sm font-medium"
                >
                  {flag.is_enabled ? 'Enabled' : 'Disabled'}
                </Label>
                <Switch
                  id={`toggle-${flag.flag_id}`}
                  checked={flag.is_enabled}
                  onCheckedChange={() => handleToggle(flag.flag_id, flag.is_enabled)}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}


'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { List, Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DevicesManager from '@/components/devices-manager'
import DevicesOrgChart from '@/components/devices-org-chart'
import { AddDeviceDialog } from '@/components/add-device-dialog'
import type { DeviceListItem } from '@/lib/api/devices-format'
import { DEVICES_CHANGED_EVENT } from '@/lib/devices-events'
import { notifyError } from '@/lib/notify'
import type { UserRole } from '@/lib/user-roles'

const VIEW_PARAM = 'view'
type ViewType = 'list' | 'org'

export default function DevicesPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = (searchParams.get(VIEW_PARAM) === 'org' ? 'org' : 'list') as ViewType

  const [devices, setDevices] = useState<DeviceListItem[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDevices = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/devices', { cache: 'no-store' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to load devices')
      }
      const data = await response.json()
      setDevices(data.devices ?? [])
      setCurrentUserId(data.currentUserId ?? null)
      setUserRole(data.userRole ?? null)
    } catch (error) {
      console.error('Failed to load devices:', error)
      notifyError(error instanceof Error ? error.message : 'Failed to load devices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDevices()
  }, [loadDevices])

  useEffect(() => {
    const handler = () => {
      void loadDevices()
    }
    window.addEventListener(DEVICES_CHANGED_EVENT, handler)
    return () => window.removeEventListener(DEVICES_CHANGED_EVENT, handler)
  }, [loadDevices])

  const setView = (next: ViewType) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'list') {
      params.delete(VIEW_PARAM)
    } else {
      params.set(VIEW_PARAM, 'org')
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  if (loading && devices.length === 0) {
    return (
      <div className="animate-pulse">
        <div className="mb-8 space-y-2">
          <div className="h-9 w-64 rounded bg-gray-200" />
          <div className="h-4 w-96 max-w-full rounded bg-gray-100" />
        </div>
        <div className="space-y-3">
          <div className="h-24 rounded-lg border border-gray-200 bg-gray-50" />
          <div className="h-24 rounded-lg border border-gray-200 bg-gray-50" />
          <div className="h-24 rounded-lg border border-gray-200 bg-gray-50" />
        </div>
      </div>
    )
  }

  if (!currentUserId || !userRole) {
    return <p className="text-sm text-gray-500">Unable to load devices.</p>
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-8 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Devices & Accounts</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage devices, iCloud profiles, and social media accounts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('list')}
              className={`h-8 gap-1.5 px-3 ${
                view === 'list'
                  ? 'border border-gray-200 bg-white font-semibold text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('org')}
              className={`h-8 gap-1.5 px-3 ${
                view === 'org'
                  ? 'border border-gray-200 bg-white font-semibold text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Network className="h-4 w-4" />
              Org chart
            </Button>
          </div>
          <AddDeviceDialog />
        </div>
      </div>

      {view === 'list' ? (
        <DevicesManager devices={devices} currentUserId={currentUserId} userRole={userRole} />
      ) : (
        <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 overflow-auto">
          <DevicesOrgChart devices={devices} currentUserId={currentUserId} userRole={userRole} />
        </div>
      )}
    </div>
  )
}

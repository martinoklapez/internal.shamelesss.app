'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DeviceDetails from '@/components/device-details'
import type { DeviceDetailItem } from '@/lib/api/devices-format'
import { DEVICE_DETAIL_CHANGED_EVENT } from '@/lib/devices-events'
import { notifyError } from '@/lib/notify'

interface DevicePageContentProps {
  deviceId: string
  backHref: string
}

export default function DevicePageContent({ deviceId, backHref }: DevicePageContentProps) {
  const [device, setDevice] = useState<DeviceDetailItem | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const loadDevice = useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    try {
      const response = await fetch(`/api/devices/${deviceId}`, { cache: 'no-store' })
      if (response.status === 404) {
        setNotFound(true)
        setDevice(null)
        return
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to load device')
      }
      const data = await response.json()
      setDevice(data.device)
      setCurrentUserId(data.currentUserId)
    } catch (error) {
      console.error('Failed to load device:', error)
      notifyError(error instanceof Error ? error.message : 'Failed to load device')
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    void loadDevice()
  }, [loadDevice])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ deviceId?: string }>).detail
      if (!detail?.deviceId || detail.deviceId === deviceId) {
        void loadDevice()
      }
    }
    window.addEventListener(DEVICE_DETAIL_CHANGED_EVENT, handler)
    return () => window.removeEventListener(DEVICE_DETAIL_CHANGED_EVENT, handler)
  }, [deviceId, loadDevice])

  if (loading && !device) {
    return (
      <div className="min-h-screen animate-pulse bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
          <div className="mb-6 flex items-center gap-4 sm:mb-8">
            <div className="h-10 w-10 rounded-md border border-gray-200 bg-gray-100" />
            <div className="space-y-2">
              <div className="h-8 w-40 rounded bg-gray-200" />
              <div className="h-4 w-28 rounded bg-gray-100" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-48 rounded-lg border border-gray-200 bg-gray-50" />
            <div className="h-48 rounded-lg border border-gray-200 bg-gray-50" />
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !device || !currentUserId) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm text-gray-600">Device not found.</p>
          <Link href={backHref} className="mt-4 inline-block text-sm font-medium text-gray-900 underline">
            Back to devices
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href={backHref}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="break-words text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
                  {`Device ${device.id}`}
                </h1>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200 sm:px-3 sm:text-sm">
                  {device.name}
                </span>
              </div>
              {device.iCloudProfile?.alias && (
                <p className="break-words text-xs text-gray-600 dark:text-gray-300 sm:text-sm">
                  alias {device.iCloudProfile.alias}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs sm:gap-6 sm:text-sm">
            {device.managerId && (device.managerName || device.managerProfilePicture) && (
              <div className="flex items-center gap-2">
                <span className="hidden font-semibold text-gray-600 dark:text-gray-400 sm:inline">Manager:</span>
                <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-1">
                  {device.managerId === currentUserId ? (
                    <>
                      {device.managerProfilePicture ? (
                        <Image
                          src={device.managerProfilePicture}
                          alt="Me"
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-xs text-gray-600">
                          M
                        </div>
                      )}
                      <span className="text-xs font-medium text-gray-900 dark:text-white sm:text-sm">Me</span>
                    </>
                  ) : (
                    <>
                      {device.managerProfilePicture ? (
                        <Image
                          src={device.managerProfilePicture}
                          alt={device.managerName || 'Manager'}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-xs text-gray-600">
                          {(device.managerName || 'M')[0].toUpperCase()}
                        </div>
                      )}
                      <span className="max-w-[100px] truncate text-xs font-medium text-gray-900 dark:text-white sm:max-w-none sm:text-sm">
                        {device.managerName || 'Manager'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
            {device.owner && (
              <div className="flex items-center gap-2">
                <span className="hidden font-semibold text-gray-600 dark:text-gray-400 sm:inline">Owner:</span>
                <span className="break-words text-xs font-medium text-gray-900 dark:text-white sm:text-sm">
                  {device.owner}
                </span>
              </div>
            )}
          </div>
        </div>

        <DeviceDetails device={device} currentUserId={currentUserId} />
      </div>
    </div>
  )
}
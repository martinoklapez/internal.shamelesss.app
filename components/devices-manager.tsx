'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Smartphone, Tablet, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SocialAccount {
  id: string
  platform: 'TikTok' | 'Instagram' | 'Snapchat'
  username: string
  name: string | null
  credentials: string
}

interface iCloudProfile {
  email: string
  credentials: string
  alias: string
  birthDate: string
  country: string
  zipCode: string
  city: string
  street: string
}

interface Proxy {
  country: string | null
}

interface Device {
  id: string
  name: string
  deviceType: 'iPhone' | 'iPad'
  managerId: string | null
  managerName: string | null
  managerProfilePicture: string | null
  owner: string | null
  iCloudProfile: iCloudProfile | null
  proxy: Proxy | null
  socialAccounts: SocialAccount[]
}

interface DevicesManagerProps {
  devices: Device[]
  currentUserId: string
  userRole: 'admin' | 'dev' | 'developer' | 'promoter' | 'user' | null
}

const platformIcons: Record<string, string> = {
  TikTok: '🎵',
  Instagram: '📷',
  Snapchat: '👻',
}

export default function DevicesManager({ devices, currentUserId, userRole }: DevicesManagerProps) {
  // Only admin and developer can see "All Devices", others default to "My Devices"
  const canViewAllDevices = userRole === 'admin' || userRole === 'dev' || userRole === 'developer'
  const [showMyDevices, setShowMyDevices] = useState(!canViewAllDevices)

  // Filter devices based on toggle state
  const filteredDevices = showMyDevices
    ? devices.filter(device => device.managerId === currentUserId)
    : devices

  if (filteredDevices.length === 0) {
    return (
      <div>
        <div className="mb-6 inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1">
          {canViewAllDevices && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMyDevices(false)}
              className={`h-8 px-4 transition-all ${
                !showMyDevices
                  ? 'bg-white text-gray-900 font-semibold shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All Devices
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMyDevices(true)}
            className={`h-8 px-4 transition-all ${
              showMyDevices
                ? 'bg-white text-gray-900 font-semibold shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            My Devices
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">
            {showMyDevices ? 'No devices assigned to you.' : 'No devices found.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1">
        {canViewAllDevices && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMyDevices(false)}
            className={`h-8 px-4 transition-all ${
              !showMyDevices
                ? 'bg-white text-gray-900 font-semibold shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            All Devices
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMyDevices(true)}
          className={`h-8 px-4 transition-all ${
            showMyDevices
              ? 'bg-white text-gray-900 font-semibold shadow-sm border border-gray-200'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          My Devices
        </Button>
      </div>
      <div className="space-y-4">
        {filteredDevices.map((device) => {
        const DeviceIcon = device.deviceType === 'iPhone' ? Smartphone : Tablet

        return (
          <Link
            key={device.id}
            href={`/devices/${device.id}`}
            className="block border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 flex-1">
                <DeviceIcon className="h-5 w-5 text-gray-600" />
                <div className="text-left flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {`Device ${device.id}`}
                    </h3>
                    {device.managerId && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 rounded-full">
                        {device.managerId === currentUserId ? (
                          <>
                            {device.managerProfilePicture ? (
                              <Image
                                src={device.managerProfilePicture}
                                alt="Me"
                                width={16}
                                height={16}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-gray-600">
                                M
                              </div>
                            )}
                            <span className="text-xs font-medium text-gray-700">
                              Me
                            </span>
                          </>
                        ) : (
                          <>
                            {device.managerProfilePicture ? (
                              <Image
                                src={device.managerProfilePicture}
                                alt={device.managerName || 'Manager'}
                                width={16}
                                height={16}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-gray-600">
                                {(device.managerName || 'M')[0].toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs font-medium text-gray-700">
                              {device.managerName || 'Manager'}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {device.iCloudProfile?.alias && (
                    <p className="text-sm text-gray-700 dark:text-gray-200 mb-0.5">
                      {device.iCloudProfile.alias}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {device.name}
                    {device.owner && ` • Owner: ${device.owner}`}
                    {device.iCloudProfile && ` • ${device.socialAccounts.length} social account${device.socialAccounts.length !== 1 ? 's' : ''}`}
                    {!device.iCloudProfile && ' • No iCloud profile'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(device.iCloudProfile?.country || device.proxy?.country) && (
                  <div className="flex items-center gap-2">
                    {device.iCloudProfile?.country && (
                      <span className="text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded">
                        iCloud: {device.iCloudProfile.country}
                      </span>
                    )}
                    {device.proxy?.country && (
                      <span className="text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded">
                        Proxy: {device.proxy.country}
                      </span>
                    )}
                  </div>
                )}
                <ChevronRight className="h-5 w-5 text-gray-500 shrink-0" />
              </div>
            </div>
          </Link>
        )
      })}
      </div>
    </div>
  )
}


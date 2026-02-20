'use client'

import { useState } from 'react'
import { List, Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DevicesManager from '@/components/devices-manager'
import DevicesOrgChart from '@/components/devices-org-chart'
import { AddDeviceDialog } from '@/components/add-device-dialog'

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

interface DevicesPageContentProps {
  devices: Device[]
  currentUserId: string
  userRole: 'admin' | 'dev' | 'developer' | 'promoter' | 'user' | 'demo' | null
}

export default function DevicesPageContent({ devices, currentUserId, userRole }: DevicesPageContentProps) {
  const [view, setView] = useState<'list' | 'org'>('list')

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Devices & Accounts
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
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
                  ? 'bg-white text-gray-900 font-semibold shadow-sm border border-gray-200'
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
                  ? 'bg-white text-gray-900 font-semibold shadow-sm border border-gray-200'
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
        <DevicesOrgChart devices={devices} currentUserId={currentUserId} userRole={userRole} />
      )}
    </>
  )
}
